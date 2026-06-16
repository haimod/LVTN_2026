<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Asset;
use App\Models\Assignment;
use App\Models\LostReport;
use App\Services\NotificationService;
use Illuminate\Http\Exceptions\HttpResponseException;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class LostReportController extends Controller
{
    public function __construct(private NotificationService $notifications)
    {
    }

    public function index(Request $request)
    {
        if (!$request->user()?->hasRole('admin')) {
            return $this->forbidden();
        }

        $query = LostReport::with([
            'asset:id,asset_code,name,category_id,department_id,status,image_path',
            'asset.category:id,name',
            'asset.department:id,name',
            'assignment:id,asset_id,user_id,status,assigned_at,confirmed_at,returned_at',
            'reportedBy:id,name,email,department_id',
            'reportedBy.department:id,name',
            'handledBy:id,name',
        ]);

        if ($request->filled('status') && in_array($request->status, ['pending', 'recovered', 'permanently_lost'], true)) {
            $query->where('status', $request->status);
        }

        if ($request->filled('search')) {
            $search = $request->search;
            $query->where(function ($q) use ($search) {
                $q->where('description', 'like', "%{$search}%")
                    ->orWhere('admin_note', 'like', "%{$search}%")
                    ->orWhereHas('asset', function ($assetQuery) use ($search) {
                        $assetQuery->where('asset_code', 'like', "%{$search}%")
                            ->orWhere('name', 'like', "%{$search}%");
                    })
                    ->orWhereHas('reportedBy', function ($userQuery) use ($search) {
                        $userQuery->where('name', 'like', "%{$search}%")
                            ->orWhere('email', 'like', "%{$search}%");
                    });
            });
        }

        $reports = $query->orderByDesc('created_at')
            ->orderByDesc('id')
            ->get();

        return response()->json([
            'status' => 'success',
            'data' => $reports,
        ]);
    }

    public function report(Request $request)
    {
        $request->validate([
            'assignment_id' => 'required|exists:assignments,id',
            'description' => 'required|string|min:10|max:2000',
        ], [
            'description.required' => 'Vui long nhap mo ta tinh huong mat thiet bi.',
            'description.min' => 'Mo ta can toi thieu 10 ky tu.',
        ]);

        $report = DB::transaction(function () use ($request) {
            $assignment = Assignment::with(['asset', 'user'])
                ->where('id', $request->assignment_id)
                ->where('user_id', $request->user()->id)
                ->where('status', 'active')
                ->lockForUpdate()
                ->first();

            if (!$assignment) {
                $this->abortWith('Chi co the bao mat thiet bi dang duoc ban muon.', 403);
            }

            if ($assignment->return_requested_at) {
                $this->abortWith('Thiet bi nay da co yeu cau tra dang cho admin xac nhan.', 400);
            }

            $asset = Asset::where('id', $assignment->asset_id)->lockForUpdate()->first();

            if (!$asset) {
                $this->abortWith('Khong tim thay tai san can bao mat.', 404);
            }

            if ($asset->status !== 'in_use') {
                $this->abortWith('Chi co the bao mat thiet bi dang su dung.', 400);
            }

            $hasOpenReport = LostReport::where('asset_id', $asset->id)
                ->where('status', 'pending')
                ->exists();

            if ($hasOpenReport) {
                $this->abortWith('Thiet bi nay da co phieu bao mat dang xu ly.', 400);
            }

            $oldStatus = $asset->status;

            $lostReport = LostReport::create([
                'asset_id' => $asset->id,
                'assignment_id' => $assignment->id,
                'reported_by' => $request->user()->id,
                'description' => $request->description,
                'status' => 'pending',
            ]);

            $asset->update([
                'status' => 'under_investigation',
            ]);

            DB::table('asset_histories')->insert([
                'asset_id' => $asset->id,
                'user_id' => $request->user()->id,
                'event_type' => 'reported_lost',
                'old_status' => $oldStatus,
                'new_status' => 'under_investigation',
                'note' => $request->description,
                'created_at' => now(),
            ]);

            return $lostReport;
        });

        $report->load([
            'asset:id,asset_code,name,category_id,department_id,status,image_path',
            'asset.category:id,name',
            'reportedBy:id,name,email,department_id',
            'reportedBy.department:id,name',
        ]);

        $this->notifications->notifyAdmins(
            'Co phieu bao mat moi',
            ($report->reportedBy?->name ?: 'Nhan vien') . ' vua bao mat ' . ($report->asset?->asset_code ?: 'thiet bi') . '.',
            'warning',
            ['lost_report_id' => $report->id, 'asset_id' => $report->asset_id]
        );

        return response()->json([
            'status' => 'success',
            'message' => 'Da gui phieu bao mat thiet bi.',
            'data' => $report,
        ], 201);
    }

    public function resolve(Request $request, int $id)
    {
        if (!$request->user()?->hasRole('admin')) {
            return $this->forbidden();
        }

        $request->validate([
            'resolution' => 'required|in:recovered,permanently_lost',
            'admin_note' => 'required|string|min:5|max:2000',
        ], [
            'admin_note.required' => 'Vui long nhap ghi chu xu ly.',
            'admin_note.min' => 'Ghi chu xu ly can toi thieu 5 ky tu.',
        ]);

        $report = DB::transaction(function () use ($request, $id) {
            $lostReport = LostReport::with(['asset', 'assignment', 'reportedBy'])
                ->where('id', $id)
                ->lockForUpdate()
                ->first();

            if (!$lostReport) {
                $this->abortWith('Khong tim thay phieu bao mat.', 404);
            }

            if ($lostReport->status !== 'pending') {
                $this->abortWith('Phieu bao mat nay da duoc xu ly.', 400);
            }

            $asset = $lostReport->asset()->lockForUpdate()->first();
            if (!$asset || $asset->status !== 'under_investigation') {
                $this->abortWith('Tai san khong o trang thai dang dieu tra bao mat.', 400);
            }

            $assignment = $lostReport->assignment_id
                ? Assignment::where('id', $lostReport->assignment_id)->lockForUpdate()->first()
                : null;

            $oldStatus = $asset->status;
            $nextAssetStatus = $request->resolution === 'recovered' ? 'new' : 'permanently_lost';
            $eventType = $request->resolution === 'recovered' ? 'lost_recovered' : 'confirmed_lost';
            $historyNote = $request->resolution === 'recovered'
                ? 'Admin xac nhan da tim lai thiet bi. ' . $request->admin_note
                : 'Admin xac nhan thiet bi mat vinh vien. ' . $request->admin_note;

            if ($assignment && $assignment->status === 'active') {
                $assignment->update([
                    'status' => 'returned',
                    'returned_at' => now(),
                    'returned_by' => $request->user()->id,
                ]);
            }

            $asset->update([
                'status' => $nextAssetStatus,
                'department_id' => null,
            ]);

            $lostReport->update([
                'status' => $request->resolution,
                'handled_by' => $request->user()->id,
                'admin_note' => $request->admin_note,
                'resolved_at' => now(),
            ]);

            DB::table('asset_histories')->insert([
                'asset_id' => $asset->id,
                'user_id' => $request->user()->id,
                'event_type' => $eventType,
                'old_status' => $oldStatus,
                'new_status' => $nextAssetStatus,
                'note' => $historyNote,
                'created_at' => now(),
            ]);

            return $lostReport;
        });

        $report->load([
            'asset:id,asset_code,name,category_id,department_id,status,image_path',
            'asset.category:id,name',
            'asset.department:id,name',
            'assignment:id,asset_id,user_id,status,assigned_at,confirmed_at,returned_at',
            'reportedBy:id,name,email,department_id',
            'reportedBy.department:id,name',
            'handledBy:id,name',
        ]);

        $message = $report->status === 'recovered'
            ? 'Admin da xac nhan tim lai thiet bi, phieu muon da duoc dong.'
            : 'Admin da xac nhan thiet bi mat vinh vien, phieu muon da duoc dong.';

        $this->notifications->notifyUser(
            $report->reportedBy,
            'Phieu bao mat da duoc xu ly',
            $message,
            $report->status === 'recovered' ? 'success' : 'warning',
            ['lost_report_id' => $report->id, 'asset_id' => $report->asset_id]
        );

        return response()->json([
            'status' => 'success',
            'message' => 'Da xu ly phieu bao mat.',
            'data' => $report,
        ]);
    }

    private function forbidden()
    {
        return response()->json([
            'status' => 'error',
            'message' => 'Ban khong co quyen xu ly phieu bao mat.',
        ], 403);
    }

    private function abortWith(string $message, int $statusCode): void
    {
        throw new HttpResponseException(response()->json([
            'status' => 'error',
            'message' => $message,
        ], $statusCode));
    }
}
