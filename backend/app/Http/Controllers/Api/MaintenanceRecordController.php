<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Asset;
use App\Models\Assignment;
use App\Models\MaintenanceRecord;
use App\Services\NotificationService;
use Illuminate\Http\Exceptions\HttpResponseException;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Str;

class MaintenanceRecordController extends Controller
{
    public function __construct(private NotificationService $notifications)
    {
    }

    public function index(Request $request)
    {
        if (!$request->user()?->hasRole('admin')) {
            return $this->forbidden();
        }

        $query = MaintenanceRecord::with([
            'asset:id,asset_code,name,category_id,department_id,status,image_path',
            'asset.category:id,name',
            'asset.department:id,name',
            'reportedBy:id,name,email,department_id',
            'reportedBy.department:id,name',
            'handledBy:id,name',
        ]);

        if ($request->filled('status') && in_array($request->status, ['pending', 'repairing', 'done'], true)) {
            $query->where('status', $request->status);
        }

        if ($request->filled('search')) {
            $search = $request->search;
            $query->where(function ($q) use ($search) {
                $q->where('description', 'like', "%{$search}%")
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

        $records = $query->orderByDesc('created_at')
            ->orderByDesc('id')
            ->get();

        return response()->json([
            'status' => 'success',
            'data' => $records,
        ]);
    }

    public function report(Request $request)
    {
        $request->validate([
            'asset_uuid' => 'required|string|max:500',
            'description' => 'required|string|min:10|max:2000',
            'image' => 'nullable|image|mimes:jpg,jpeg,png,webp|max:4096',
        ], [
            'description.required' => 'Vui long nhap mo ta su co.',
            'description.min' => 'Mo ta su co can toi thieu 10 ky tu.',
        ]);

        $record = DB::transaction(function () use ($request) {
            $assetUuid = $this->extractAssetUuid($request->asset_uuid);
            $asset = Asset::where('uuid', $assetUuid)->lockForUpdate()->first();

            if (!$asset) {
                $this->abortWith('Khong tim thay tai san tu ma QR nay.', 404);
            }

            $assignment = Assignment::where('asset_id', $asset->id)
                ->where('user_id', $request->user()->id)
                ->where('status', 'active')
                ->lockForUpdate()
                ->first();

            if (!$assignment) {
                $this->abortWith('Chi nguoi dang giu tai san moi duoc bao hong thiet bi nay.', 403);
            }

            if ($assignment->return_requested_at) {
                $this->abortWith('Thiet bi nay da co yeu cau tra dang cho admin xac nhan.', 400);
            }

            if ($asset->status !== 'in_use') {
                $this->abortWith('Chi co the bao hong thiet bi dang su dung.', 400);
            }

            $hasOpenMaintenance = MaintenanceRecord::where('asset_id', $asset->id)
                ->whereIn('status', ['pending', 'repairing'])
                ->exists();

            if ($hasOpenMaintenance) {
                $this->abortWith('Thiet bi nay da co phieu bao tri chua dong.', 400);
            }

            $oldStatus = $asset->status;
            $imagePath = $this->storeImage($request, $asset->asset_code);

            $record = MaintenanceRecord::create([
                'asset_id' => $asset->id,
                'reported_by' => $request->user()->id,
                'description' => $request->description,
                'image_path' => $imagePath,
                'status' => 'pending',
            ]);

            $asset->update([
                'status' => 'waiting',
            ]);

            DB::table('asset_histories')->insert([
                'asset_id' => $asset->id,
                'user_id' => $request->user()->id,
                'event_type' => 'reported_damage',
                'old_status' => $oldStatus,
                'new_status' => 'waiting',
                'note' => $request->description,
                'created_at' => now(),
            ]);

            return $record;
        });

        $record->load([
            'asset:id,asset_code,name,category_id,department_id,status,image_path',
            'asset.category:id,name',
            'reportedBy:id,name,email,department_id',
            'reportedBy.department:id,name',
        ]);

        $this->notifications->notifyAdmins(
            'Co phieu bao hong moi',
            ($record->reportedBy?->name ?: 'Nhan vien') . ' vua bao hong ' . ($record->asset?->asset_code ?: 'thiet bi') . '.',
            'warning',
            ['maintenance_id' => $record->id, 'asset_id' => $record->asset_id]
        );

        return response()->json([
            'status' => 'success',
            'message' => 'Da gui phieu bao hong thiet bi.',
            'data' => $record,
        ], 201);
    }

    public function receive(Request $request, int $id)
    {
        if (!$request->user()?->hasRole('admin')) {
            return $this->forbidden();
        }

        $record = DB::transaction(function () use ($request, $id) {
            $record = MaintenanceRecord::with(['asset', 'reportedBy'])
                ->where('id', $id)
                ->lockForUpdate()
                ->first();

            if (!$record) {
                $this->abortWith('Khong tim thay phieu bao tri.', 404);
            }

            if ($record->status !== 'pending') {
                $this->abortWith('Chi co the tiep nhan phieu bao tri dang cho xu ly.', 400);
            }

            $asset = $record->asset()->lockForUpdate()->first();
            if (!$asset || $asset->status !== 'waiting') {
                $this->abortWith('Tai san khong o trang thai cho xu ly bao tri.', 400);
            }

            $assignment = Assignment::where('asset_id', $asset->id)
                ->where('user_id', $record->reported_by)
                ->where('status', 'active')
                ->lockForUpdate()
                ->first();

            if (!$assignment) {
                $this->abortWith('Khong tim thay phieu ban giao dang active de cat trach nhiem nhan vien.', 400);
            }

            $oldStatus = $asset->status;

            $assignment->update([
                'status' => 'returned',
                'returned_at' => now(),
                'returned_by' => $request->user()->id,
            ]);

            $asset->update([
                'status' => 'repairing',
                'department_id' => null,
            ]);

            $record->update([
                'status' => 'repairing',
                'handled_by' => $request->user()->id,
            ]);

            DB::table('asset_histories')->insert([
                'asset_id' => $asset->id,
                'user_id' => $request->user()->id,
                'event_type' => 'repairing',
                'old_status' => $oldStatus,
                'new_status' => 'repairing',
                'note' => 'Admin tiep nhan thiet bi bao hong, dong phieu ban giao cua nhan vien.',
                'created_at' => now(),
            ]);

            return $record;
        });

        $record->load([
            'asset:id,asset_code,name,category_id,department_id,status,image_path',
            'asset.category:id,name',
            'reportedBy:id,name,email,department_id',
            'reportedBy.department:id,name',
            'handledBy:id,name',
        ]);

        $this->notifications->notifyUser(
            $record->reportedBy,
            'Admin da tiep nhan thiet bi bao hong',
            'Trach nhiem cua ban voi ' . ($record->asset?->asset_code ?: 'thiet bi') . ' da duoc cat khi admin tiep nhan xu ly.',
            'success',
            ['maintenance_id' => $record->id, 'asset_id' => $record->asset_id]
        );

        return response()->json([
            'status' => 'success',
            'message' => 'Da tiep nhan xu ly bao tri.',
            'data' => $record,
        ]);
    }

    public function complete(Request $request, int $id)
    {
        if (!$request->user()?->hasRole('admin')) {
            return $this->forbidden();
        }

        $request->validate([
            'repair_cost' => 'required|numeric|min:0',
        ], [
            'repair_cost.required' => 'Vui long nhap chi phi sua chua.',
        ]);

        $record = DB::transaction(function () use ($request, $id) {
            $record = MaintenanceRecord::with(['asset', 'reportedBy'])
                ->where('id', $id)
                ->lockForUpdate()
                ->first();

            if (!$record) {
                $this->abortWith('Khong tim thay phieu bao tri.', 404);
            }

            if ($record->status !== 'repairing') {
                $this->abortWith('Chi co the dong phieu dang bao tri.', 400);
            }

            $asset = $record->asset()->lockForUpdate()->first();
            if (!$asset || $asset->status !== 'repairing') {
                $this->abortWith('Tai san khong o trang thai dang bao tri.', 400);
            }

            $oldStatus = $asset->status;

            $record->update([
                'status' => 'done',
                'handled_by' => $record->handled_by ?: $request->user()->id,
                'repair_cost' => $request->repair_cost,
                'repaired_at' => now(),
            ]);

            $asset->update([
                'status' => 'new',
                'department_id' => null,
            ]);

            DB::table('asset_histories')->insert([
                'asset_id' => $asset->id,
                'user_id' => $request->user()->id,
                'event_type' => 'repaired',
                'old_status' => $oldStatus,
                'new_status' => 'new',
                'note' => 'Hoan tat bao tri, thiet bi ve kho tong. Chi phi: ' . $request->repair_cost,
                'created_at' => now(),
            ]);

            return $record;
        });

        $record->load([
            'asset:id,asset_code,name,category_id,department_id,status,image_path',
            'asset.category:id,name',
            'reportedBy:id,name,email,department_id',
            'reportedBy.department:id,name',
            'handledBy:id,name',
        ]);

        $this->notifications->notifyUser(
            $record->reportedBy,
            'Thiet bi da hoan tat bao tri',
            ($record->asset?->asset_code ?: 'Thiet bi') . ' da sua xong va ve kho tong.',
            'info',
            ['maintenance_id' => $record->id, 'asset_id' => $record->asset_id]
        );

        return response()->json([
            'status' => 'success',
            'message' => 'Da dong phieu bao tri va dua thiet bi ve kho.',
            'data' => $record,
        ]);
    }

    private function forbidden()
    {
        return response()->json([
            'status' => 'error',
            'message' => 'Ban khong co quyen xu ly bao tri.'
        ], 403);
    }

    private function abortWith(string $message, int $statusCode): void
    {
        throw new HttpResponseException(response()->json([
            'status' => 'error',
            'message' => $message,
        ], $statusCode));
    }

    private function extractAssetUuid(string $rawValue): string
    {
        $value = trim($rawValue);
        $parts = parse_url($value);

        if (!empty($parts['query'])) {
            parse_str($parts['query'], $query);
            foreach (['code', 'asset_uuid', 'uuid'] as $key) {
                if (!empty($query[$key])) {
                    return trim((string) $query[$key]);
                }
            }
        }

        return $value;
    }

    private function storeImage(Request $request, string $assetCode): ?string
    {
        if (!$request->hasFile('image')) {
            return null;
        }

        $directory = public_path('uploads/maintenance');
        File::ensureDirectoryExists($directory);

        $file = $request->file('image');
        $extension = strtolower($file->getClientOriginalExtension());
        $filename = $assetCode . '-' . Str::random(8) . '.' . $extension;

        $file->move($directory, $filename);

        return 'uploads/maintenance/' . $filename;
    }
}
