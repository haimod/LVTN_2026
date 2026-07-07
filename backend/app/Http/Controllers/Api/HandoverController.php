<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Asset;
use App\Models\Assignment;
use App\Services\NotificationService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class HandoverController extends Controller
{
    public function __construct(private NotificationService $notifications)
    {
    }

    public function createSession(Request $request)
    {
        $request->validate([
            'asset_uuid' => 'required|string|max:500',
        ]);

        $assetUuid = $this->extractAssetUuid($request->asset_uuid);
        $asset = Asset::with(['category:id,name', 'department:id,name'])
            ->where('uuid', $assetUuid)
            ->first();

        if (!$asset) {
            return response()->json([
                'status' => 'error',
                'message' => 'Khong tim thay tai san tu ma QR nay.',
            ], 404);
        }

        if (in_array($asset->status, ['under_investigation', 'permanently_lost'], true)) {
            return response()->json([
                'status' => 'success',
                'message' => 'Tai san nay dang nam trong luong bao mat/blacklist.',
                'data' => [
                    'can_confirm' => false,
                    'can_report_damage' => false,
                    'can_request_return' => false,
                    'is_blacklisted' => true,
                    'asset' => $asset,
                    'assignment' => null,
                ],
            ]);
        }

        $assignment = Assignment::with([
            'asset:id,uuid,asset_code,name,category_id,department_id,image_path,status',
            'asset.category:id,name',
            'asset.department:id,name',
            'user:id,name,email,department_id',
            'assignedBy:id,name',
        ])
            ->where('asset_id', $asset->id)
            ->where('user_id', $request->user()->id)
            ->where('status', 'waiting')
            ->orderByDesc('assigned_at')
            ->first();

        $activeAssignment = Assignment::with([
            'asset:id,uuid,asset_code,name,category_id,department_id,image_path,status',
            'asset.category:id,name',
            'asset.department:id,name',
            'user:id,name,email,department_id',
            'assignedBy:id,name',
        ])
            ->where('asset_id', $asset->id)
            ->where('user_id', $request->user()->id)
            ->where('status', 'active')
            ->orderByDesc('confirmed_at')
            ->first();

        if (!$assignment) {
            $canRequestReturn = $activeAssignment && $asset->status === 'in_use' && !$activeAssignment->return_requested_at;

            return response()->json([
                'status' => 'success',
                'message' => 'Ma QR hop le nhung khong nam trong danh sach ban giao dang cho ban xac nhan.',
                'data' => [
                    'can_confirm' => false,
                    'can_report_damage' => $canRequestReturn,
                    'can_request_return' => $canRequestReturn,
                    'asset' => $asset,
                    'assignment' => $activeAssignment,
                ],
            ]);
        }

        $token = (string) Str::uuid();
        $expiresAt = now()->addMinutes(5);

        Cache::put('handover:' . $token, [
            'assignment_id' => $assignment->id,
            'user_id' => $request->user()->id,
        ], $expiresAt);

        return response()->json([
            'status' => 'success',
            'message' => 'Da tao phien xac nhan ban giao trong 5 phut.',
            'data' => [
                'can_confirm' => true,
                'can_report_damage' => false,
                'can_request_return' => false,
                'token' => $token,
                'expires_at' => $expiresAt->toDateTimeString(),
                'asset' => $assignment->asset,
                'assignment' => $assignment,
            ],
        ]);
    }

    public function confirm(Request $request, string $token)
    {
        $session = Cache::get('handover:' . $token);

        if (!$session) {
            return response()->json([
                'status' => 'error',
                'message' => 'Phien xac nhan da het han. Vui long quet lai ma QR.',
            ], 400);
        }

        if ((string) $session['user_id'] !== (string) $request->user()->id) {
            return response()->json([
                'status' => 'error',
                'message' => 'Phien xac nhan khong thuoc tai khoan hien tai.',
            ], 403);
        }

        $assignment = DB::transaction(function () use ($session, $request) {
            $assignment = Assignment::with(['asset', 'user.department', 'assignedBy'])
                ->where('id', $session['assignment_id'])
                ->lockForUpdate()
                ->first();

            if (!$assignment || (string) $assignment->user_id !== (string) $request->user()->id) {
                return null;
            }

            if ($assignment->status !== 'waiting') {
                return null;
            }

            $asset = $assignment->asset()->lockForUpdate()->first();
            if (!$asset || $asset->status !== 'waiting') {
                return null;
            }

            $oldStatus = $asset->status;

            $assignment->update([
                'status' => 'active',
                'confirmed_at' => now(),
            ]);

            $asset->update([
                'status' => 'in_use',
                'department_id' => $assignment->user?->department_id,
            ]);

            DB::table('asset_histories')->insert([
                'asset_id' => $asset->id,
                'user_id' => $request->user()->id,
                'event_type' => 'confirmed_handover',
                'old_status' => $oldStatus,
                'new_status' => 'in_use',
                'note' => 'Nhan vien xac nhan nhan tai san qua QR.',
                'created_at' => now(),
            ]);

            return $assignment;
        });

        if (!$assignment) {
            return response()->json([
                'status' => 'error',
                'message' => 'Phieu ban giao khong con hop le de xac nhan.',
            ], 400);
        }

        Cache::forget('handover:' . $token);

        $assignment->load([
            'asset:id,uuid,asset_code,name,category_id,department_id,image_path,status',
            'asset.category:id,name',
            'asset.department:id,name',
            'user:id,name,email,department_id',
            'user.department:id,name,manager_id',
            'assignedBy:id,name',
        ]);

        $assetCode = $assignment->asset?->asset_code ?: 'tai san';
        $this->notifications->notifyUser(
            $assignment->assignedBy,
            'Nhan vien da xac nhan ban giao',
            $assignment->user?->name . ' da xac nhan nhan ' . $assetCode . '.',
            'success',
            ['assignment_id' => $assignment->id, 'asset_id' => $assignment->asset_id]
        );

        $isEmergency = (bool) ($assignment->is_emergency ?? false) || $assignment->request_id === null;
        if ($isEmergency) {
            $this->notifications->notifyDepartmentManager(
                $assignment->user?->department_id,
                'Cap phat khan cap da duoc xac nhan',
                'Admin ' . ($assignment->assignedBy?->name ?: '') . ' vua cap phat khan cap ' . $assetCode . ' cho ' . ($assignment->user?->name ?: 'nhan vien') . '.',
                'warning',
                ['assignment_id' => $assignment->id, 'asset_id' => $assignment->asset_id]
            );
        }

        return response()->json([
            'status' => 'success',
            'message' => 'Da xac nhan nhan tai san.',
            'data' => $assignment,
        ]);
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
}
