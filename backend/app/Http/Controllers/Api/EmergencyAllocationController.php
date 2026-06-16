<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Asset;
use App\Models\Assignment;
use App\Models\User;
use App\Services\NotificationService;
use Illuminate\Http\Exceptions\HttpResponseException;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class EmergencyAllocationController extends Controller
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
            'asset:id,asset_code,name,category_id,status',
            'asset.category:id,name',
            'user:id,name,email,department_id',
            'user.department:id,name',
            'assignedBy:id,name',
        ])->whereNull('request_id');

        if ($request->filled('status') && in_array($request->status, ['waiting', 'active', 'returned'], true)) {
            $query->where('status', $request->status);
        }

        $assignments = $query->orderByDesc('assigned_at')
            ->orderByDesc('id')
            ->get();

        return response()->json([
            'status' => 'success',
            'data' => $assignments
        ], 200);
    }

    public function store(Request $request)
    {
        if (!$request->user()?->hasRole('admin')) {
            return $this->forbidden();
        }

        $request->validate([
            'asset_id' => 'required|exists:assets,id',
            'user_id' => 'required|exists:users,id,is_active,1',
            'reason' => 'required|string|min:10|max:1000',
        ], [
            'user_id.exists' => 'Nhân viên không tồn tại hoặc tài khoản đang bị khóa.',
            'reason.min' => 'Lý do cấp phát khẩn cấp cần tối thiểu 10 ký tự.',
        ]);

        $assignment = DB::transaction(function () use ($request) {
            $asset = Asset::with('category')
                ->where('id', $request->asset_id)
                ->lockForUpdate()
                ->first();

            if (!$asset) {
                $this->abortWith('Không tìm thấy tài sản.', 404);
            }

            if ($asset->status !== 'new') {
                $this->abortWith('Chỉ có thể cấp phát khẩn cấp thiết bị đang rảnh trong kho.', 400);
            }

            if ($asset->department_id !== null) {
                $this->abortWith('Chi co the cap phat khan cap thiet bi dang nam trong kho tong, chua gan phong ban.', 400);
            }

            $hasOpenAssignment = Assignment::where('asset_id', $asset->id)
                ->whereIn('status', ['waiting', 'active'])
                ->exists();

            if ($hasOpenAssignment) {
                $this->abortWith('Thiết bị này đang có phiếu bàn giao chưa đóng.', 400);
            }

            $receiver = User::with('department')
                ->where('id', $request->user_id)
                ->where('is_active', 1)
                ->first();

            if (!$receiver) {
                $this->abortWith('Nhân viên không tồn tại hoặc tài khoản đang bị khóa.', 404);
            }

            $oldStatus = $asset->status;
            $note = 'Cấp phát khẩn cấp. Lý do: ' . $request->reason;

            $assignment = Assignment::create([
                'asset_id' => $asset->id,
                'user_id' => $receiver->id,
                'assigned_by' => $request->user()->id,
                'request_id' => null,
                'is_emergency' => true,
                'status' => 'waiting',
                'note' => $note,
                'assigned_at' => now(),
            ]);

            $asset->update([
                'status' => 'waiting',
            ]);

            DB::table('asset_histories')->insert([
                'asset_id' => $asset->id,
                'user_id' => $request->user()->id,
                'event_type' => 'assigned',
                'old_status' => $oldStatus,
                'new_status' => 'waiting',
                'note' => 'Cấp phát khẩn cấp ' . $asset->asset_code . ' cho ' . $receiver->name . '. Lý do: ' . $request->reason,
                'created_at' => now(),
            ]);

            return $assignment;
        });

        $assignment->load([
            'asset:id,asset_code,name,category_id,status',
            'asset.category:id,name',
            'user:id,name,email,department_id',
            'user.department:id,name',
            'assignedBy:id,name',
        ]);

        $this->notifications->notifyUser(
            $assignment->user,
            'Phieu cap phat khan cap dang cho xac nhan',
            'Admin da cap phat ' . ($assignment->asset?->asset_code ?: 'thiet bi') . ' cho ban. Vui long quet QR de xac nhan nhan tai san.',
            'warning',
            ['assignment_id' => $assignment->id, 'asset_id' => $assignment->asset_id]
        );

        return response()->json([
            'status' => 'success',
            'message' => 'Đã tạo phiếu cấp phát khẩn cấp, chờ nhân viên xác nhận nhận thiết bị.',
            'data' => $assignment
        ], 201);
    }

    private function forbidden()
    {
        return response()->json([
            'status' => 'error',
            'message' => 'Bạn không có quyền cấp phát khẩn cấp.'
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
