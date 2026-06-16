<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Assignment;
use App\Services\NotificationService;
use Illuminate\Http\Exceptions\HttpResponseException;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class ReturnRequestController extends Controller
{
    public function __construct(private NotificationService $notifications)
    {
    }

    public function index(Request $request)
    {
        if (!$request->user()?->hasRole('admin')) {
            return $this->forbidden();
        }

        $query = Assignment::with([
            'asset:id,uuid,asset_code,name,category_id,department_id,image_path,status',
            'asset.category:id,name',
            'asset.department:id,name',
            'user:id,name,email,department_id',
            'user.department:id,name',
            'assignedBy:id,name',
            'returnedBy:id,name',
        ])->whereNotNull('return_requested_at');

        if ($request->filled('status')) {
            if ($request->status === 'pending') {
                $query->where('status', 'active')->whereNull('returned_at');
            }

            if ($request->status === 'confirmed') {
                $query->where('status', 'returned')->whereNotNull('returned_at');
            }
        }

        if ($request->filled('search')) {
            $search = $request->search;
            $query->where(function ($q) use ($search) {
                $q->where('return_reason', 'like', "%{$search}%")
                    ->orWhere('return_admin_note', 'like', "%{$search}%")
                    ->orWhereHas('asset', function ($assetQuery) use ($search) {
                        $assetQuery->where('asset_code', 'like', "%{$search}%")
                            ->orWhere('name', 'like', "%{$search}%");
                    })
                    ->orWhereHas('user', function ($userQuery) use ($search) {
                        $userQuery->where('name', 'like', "%{$search}%")
                            ->orWhere('email', 'like', "%{$search}%");
                    });
            });
        }

        $assignments = $query->orderByDesc('return_requested_at')
            ->orderByDesc('id')
            ->get();

        return response()->json([
            'status' => 'success',
            'data' => $assignments,
        ]);
    }

    public function requestReturn(Request $request)
    {
        $request->validate([
            'assignment_id' => 'required|exists:assignments,id',
            'return_reason' => 'nullable|string|max:2000',
        ]);

        $assignment = DB::transaction(function () use ($request) {
            $assignment = Assignment::with(['asset', 'user'])
                ->where('id', $request->assignment_id)
                ->where('user_id', $request->user()->id)
                ->where('status', 'active')
                ->lockForUpdate()
                ->first();

            if (!$assignment) {
                $this->abortWith('Chi co the gui yeu cau tra thiet bi dang duoc ban muon.', 403);
            }

            if ($assignment->return_requested_at) {
                $this->abortWith('Thiet bi nay da co yeu cau tra dang cho admin xac nhan.', 400);
            }

            $asset = $assignment->asset()->lockForUpdate()->first();
            if (!$asset || $asset->status !== 'in_use') {
                $this->abortWith('Chi co the tra thiet bi dang su dung binh thuong.', 400);
            }

            $assignment->update([
                'return_requested_at' => now(),
                'return_reason' => $request->return_reason,
            ]);

            DB::table('asset_histories')->insert([
                'asset_id' => $asset->id,
                'user_id' => $request->user()->id,
                'event_type' => 'return_requested',
                'old_status' => $asset->status,
                'new_status' => $asset->status,
                'note' => $request->return_reason ?: 'Nhan vien gui yeu cau tra thiet bi.',
                'created_at' => now(),
            ]);

            return $assignment;
        });

        $assignment->load([
            'asset:id,uuid,asset_code,name,category_id,department_id,image_path,status',
            'asset.category:id,name',
            'user:id,name,email,department_id',
            'user.department:id,name',
        ]);

        $this->notifications->notifyAdmins(
            'Co yeu cau tra thiet bi',
            ($assignment->user?->name ?: 'Nhan vien') . ' muon tra ' . ($assignment->asset?->asset_code ?: 'thiet bi') . '.',
            'info',
            ['assignment_id' => $assignment->id, 'asset_id' => $assignment->asset_id]
        );

        return response()->json([
            'status' => 'success',
            'message' => 'Da gui yeu cau tra thiet bi.',
            'data' => $assignment,
        ], 201);
    }

    public function confirm(Request $request, int $id)
    {
        if (!$request->user()?->hasRole('admin')) {
            return $this->forbidden();
        }

        $request->validate([
            'return_admin_note' => 'nullable|string|max:2000',
        ]);

        $assignment = DB::transaction(function () use ($request, $id) {
            $assignment = Assignment::with(['asset', 'user'])
                ->where('id', $id)
                ->lockForUpdate()
                ->first();

            if (!$assignment) {
                $this->abortWith('Khong tim thay phieu muon can thu hoi.', 404);
            }

            if (!$assignment->return_requested_at || $assignment->status !== 'active') {
                $this->abortWith('Phieu nay khong o trang thai cho xac nhan tra.', 400);
            }

            $asset = $assignment->asset()->lockForUpdate()->first();
            if (!$asset || $asset->status !== 'in_use') {
                $this->abortWith('Tai san khong o trang thai dang su dung de nhan tra.', 400);
            }

            $oldStatus = $asset->status;

            $assignment->update([
                'status' => 'returned',
                'returned_at' => now(),
                'returned_by' => $request->user()->id,
                'return_admin_note' => $request->return_admin_note,
            ]);

            $asset->update([
                'status' => 'new',
                'department_id' => null,
            ]);

            DB::table('asset_histories')->insert([
                'asset_id' => $asset->id,
                'user_id' => $request->user()->id,
                'event_type' => 'returned_to_warehouse',
                'old_status' => $oldStatus,
                'new_status' => 'new',
                'note' => $request->return_admin_note ?: 'Admin xac nhan da nhan lai thiet bi, dua ve kho tong.',
                'created_at' => now(),
            ]);

            return $assignment;
        });

        $assignment->load([
            'asset:id,uuid,asset_code,name,category_id,department_id,image_path,status',
            'asset.category:id,name',
            'asset.department:id,name',
            'user:id,name,email,department_id',
            'user.department:id,name',
            'returnedBy:id,name',
        ]);

        $this->notifications->notifyUser(
            $assignment->user,
            'Admin da xac nhan tra thiet bi',
            ($assignment->asset?->asset_code ?: 'Thiet bi') . ' da duoc admin nhan lai va dua ve kho tong.',
            'success',
            ['assignment_id' => $assignment->id, 'asset_id' => $assignment->asset_id]
        );

        return response()->json([
            'status' => 'success',
            'message' => 'Da xac nhan nhan lai thiet bi.',
            'data' => $assignment,
        ]);
    }

    private function forbidden()
    {
        return response()->json([
            'status' => 'error',
            'message' => 'Ban khong co quyen xu ly phieu thu hoi.',
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
