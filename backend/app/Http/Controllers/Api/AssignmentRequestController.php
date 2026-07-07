<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Asset;
use App\Models\Assignment;
use App\Models\AssignmentRequest;
use App\Services\NotificationService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class AssignmentRequestController extends Controller
{
    public function __construct(private NotificationService $notifications)
    {
    }

    public function index(Request $request)
    {
        $user = $request->user();
        $role = $user?->roles()->value('name');

        $query = AssignmentRequest::with([
            'requester:id,name,email,department_id',
            'requester.department:id,name',
            'requester.roles:id,name',
            'category:id,name',
            'manager:id,name',
            'admin:id,name',
        ]);

        if ($role === 'admin') {
            // Admin sẽ dùng danh sách này ở bước cấp phát sau.
        } elseif ($role === 'manager') {
            if ($request->scope === 'mine') {
                $query->where('requester_id', $user->id);
            } elseif ($request->scope === 'department') {
                if (!$this->isPrimaryDepartmentManager($user)) {
                    return response()->json([
                        'status' => 'error',
                        'message' => 'Chỉ trưởng phòng duyệt chính mới được xem danh sách yêu cầu chờ duyệt.'
                    ], 403);
                }

                $user->department_id
                    ? $query->whereHas('requester', function ($subQuery) use ($user) {
                        $subQuery->where('department_id', $user->department_id)
                            ->where('id', '!=', $user->id);
                    })
                    : $query->whereRaw('1 = 0');
            } else {
                $query->where('requester_id', $user->id);
            }
        } else {
            $query->where('requester_id', $user->id);
        }

        if ($request->filled('status')) {
            $query->where('status', $request->status);
        }

        $requests = $query->orderBy('created_at', 'desc')->get();

        return response()->json([
            'status' => 'success',
            'data' => $requests
        ], 200);
    }

    public function store(Request $request)
    {
        $user = $request->user();
        $role = $user?->roles()->value('name');

        if ($role === 'admin') {
            return response()->json([
                'status' => 'error',
                'message' => 'Admin không cần tạo yêu cầu mượn thiết bị.'
            ], 400);
        }

        $request->validate([
            'category_id' => 'required|exists:categories,id',
            'requested_specification' => 'required|string|min:5|max:2000',
            'expected_return_date' => 'required|date|after_or_equal:today',
            'reason' => 'required|string|min:10|max:2000',
        ], [
            'requested_specification.required' => 'Vui lòng mô tả thiết bị hoặc cấu hình mong muốn.',
            'requested_specification.min' => 'Mô tả thiết bị/cấu hình mong muốn cần tối thiểu 5 ký tự.',
            'expected_return_date.required' => 'Vui lòng chọn ngày dự kiến trả thiết bị.',
            'expected_return_date.after_or_equal' => 'Ngày dự kiến trả không được nhỏ hơn ngày hiện tại.',
            'reason.min' => 'Lý do mượn thiết bị cần tối thiểu 10 ký tự.',
        ]);

        $data = [
            'requester_id' => $user->id,
            'category_id' => $request->category_id,
            'requested_specification' => $request->requested_specification,
            'reason' => $request->reason,
            'expected_return_date' => $request->expected_return_date,
            'status' => 'pending',
        ];

        if ($role === 'manager') {
            $data['status'] = 'mgr_approved';
            $data['manager_id'] = $user->id;
            $data['manager_note'] = 'Yêu cầu cấp quản lý, bỏ qua bước tự duyệt nội bộ.';
            $data['manager_at'] = now();
        }

        $assignmentRequest = AssignmentRequest::create($data);
        $assignmentRequest->load([
            'requester:id,name,email,department_id',
            'requester.department:id,name',
            'requester.roles:id,name',
            'category:id,name',
            'manager:id,name',
            'admin:id,name',
        ]);

        if ($assignmentRequest->status === 'mgr_approved') {
            $this->notifications->notifyAdmins(
                'Yeu cau cap quan ly',
                ($assignmentRequest->requester?->name ?: 'Quan ly') . ' vua tao yeu cau muon ' . ($assignmentRequest->category?->name ?: 'thiet bi') . '.',
                'info',
                ['request_id' => $assignmentRequest->id]
            );
        } else {
            $this->notifications->notifyDepartmentManager(
                $user->department_id,
                'Yeu cau muon moi',
                ($user->name ?: 'Nhan vien') . ' vua gui yeu cau muon ' . ($assignmentRequest->category?->name ?: 'thiet bi') . '.',
                'info',
                ['request_id' => $assignmentRequest->id]
            );
        }

        return response()->json([
            'status' => 'success',
            'message' => 'Gửi yêu cầu mượn thiết bị thành công!',
            'data' => $assignmentRequest
        ], 201);
    }

    public function show(Request $request, $id)
    {
        $assignmentRequest = AssignmentRequest::with([
            'requester:id,name,email,department_id',
            'requester.department:id,name',
            'requester.roles:id,name',
            'category:id,name',
            'manager:id,name',
            'admin:id,name',
        ])->find($id);

        if (!$assignmentRequest) {
            return response()->json(['status' => 'error', 'message' => 'Không tìm thấy yêu cầu'], 404);
        }

        if (!$this->canView($request, $assignmentRequest)) {
            return response()->json([
                'status' => 'error',
                'message' => 'Bạn không có quyền xem yêu cầu này.'
            ], 403);
        }

        return response()->json([
            'status' => 'success',
            'data' => $assignmentRequest
        ], 200);
    }

    public function managerApprove(Request $request, $id)
    {
        $assignmentRequest = AssignmentRequest::with(['requester.department', 'category', 'manager', 'admin'])->find($id);

        if (!$assignmentRequest) {
            return response()->json(['status' => 'error', 'message' => 'Không tìm thấy yêu cầu'], 404);
        }

        if (!$this->canManagerReview($request, $assignmentRequest)) {
            return response()->json([
                'status' => 'error',
                'message' => 'Bạn không có quyền duyệt yêu cầu này.'
            ], 403);
        }

        if ($assignmentRequest->status !== 'pending') {
            return response()->json([
                'status' => 'error',
                'message' => 'Chỉ có thể duyệt yêu cầu đang chờ trưởng phòng.'
            ], 400);
        }

        $request->validate([
            'manager_note' => 'nullable|string|max:1000',
        ]);

        $assignmentRequest->update([
            'status' => 'mgr_approved',
            'manager_id' => $request->user()->id,
            'manager_note' => $request->manager_note,
            'manager_at' => now(),
        ]);

        $assignmentRequest->load([
            'requester:id,name,email,department_id',
            'requester.department:id,name',
            'requester.roles:id,name',
            'category:id,name',
            'manager:id,name',
            'admin:id,name',
        ]);

        $this->notifications->notifyAdmins(
            'Truong phong da duyet yeu cau',
            ($assignmentRequest->manager?->name ?: 'Truong phong') . ' da duyet yeu cau YC-' . str_pad((string) $assignmentRequest->id, 5, '0', STR_PAD_LEFT) . '.',
            'success',
            ['request_id' => $assignmentRequest->id]
        );

        $this->notifications->notifyUser(
            $assignmentRequest->requester,
            'Yeu cau da duoc truong phong duyet',
            'Yeu cau muon ' . ($assignmentRequest->category?->name ?: 'thiet bi') . ' dang cho admin cap phat.',
            'success',
            ['request_id' => $assignmentRequest->id]
        );

        return response()->json([
            'status' => 'success',
            'message' => 'Đã duyệt yêu cầu mượn thiết bị.',
            'data' => $assignmentRequest
        ], 200);
    }

    public function managerReject(Request $request, $id)
    {
        $assignmentRequest = AssignmentRequest::with(['requester.department', 'category', 'manager', 'admin'])->find($id);

        if (!$assignmentRequest) {
            return response()->json(['status' => 'error', 'message' => 'Không tìm thấy yêu cầu'], 404);
        }

        if (!$this->canManagerReview($request, $assignmentRequest)) {
            return response()->json([
                'status' => 'error',
                'message' => 'Bạn không có quyền từ chối yêu cầu này.'
            ], 403);
        }

        if ($assignmentRequest->status !== 'pending') {
            return response()->json([
                'status' => 'error',
                'message' => 'Chỉ có thể từ chối yêu cầu đang chờ trưởng phòng.'
            ], 400);
        }

        $request->validate([
            'manager_note' => 'required|string|min:5|max:1000',
        ], [
            'manager_note.required' => 'Vui lòng nhập lý do từ chối.',
            'manager_note.min' => 'Lý do từ chối cần tối thiểu 5 ký tự.',
        ]);

        $assignmentRequest->update([
            'status' => 'rejected',
            'manager_id' => $request->user()->id,
            'manager_note' => $request->manager_note,
            'manager_at' => now(),
        ]);

        $assignmentRequest->load([
            'requester:id,name,email,department_id',
            'requester.department:id,name',
            'requester.roles:id,name',
            'category:id,name',
            'manager:id,name',
            'admin:id,name',
        ]);

        $this->notifications->notifyUser(
            $assignmentRequest->requester,
            'Yeu cau bi truong phong tu choi',
            'Ly do: ' . $assignmentRequest->manager_note,
            'warning',
            ['request_id' => $assignmentRequest->id]
        );

        return response()->json([
            'status' => 'success',
            'message' => 'Đã từ chối yêu cầu mượn thiết bị.',
            'data' => $assignmentRequest
        ], 200);
    }

    public function adminFulfill(Request $request, $id)
    {
        if (!$request->user()?->hasRole('admin')) {
            return response()->json([
                'status' => 'error',
                'message' => 'Bạn không có quyền cấp phát thiết bị.'
            ], 403);
        }

        $request->validate([
            'asset_id' => 'required|exists:assets,id',
            'admin_note' => 'nullable|string|max:1000',
        ]);

        $assignmentRequest = DB::transaction(function () use ($request, $id) {
            $assignmentRequest = AssignmentRequest::with(['requester.department', 'category'])
                ->where('id', $id)
                ->lockForUpdate()
                ->first();

            if (!$assignmentRequest) {
                abort(response()->json(['status' => 'error', 'message' => 'Không tìm thấy yêu cầu'], 404));
            }

            if (!in_array($assignmentRequest->status, ['mgr_approved', 'out_of_stock'], true)) {
                abort(response()->json([
                    'status' => 'error',
                    'message' => 'Chỉ có thể cấp phát yêu cầu đã được trưởng phòng duyệt hoặc yêu cầu cấp quản lý.'
                ], 400));
            }

            $asset = Asset::where('id', $request->asset_id)
                ->lockForUpdate()
                ->first();

            if (!$asset) {
                abort(response()->json(['status' => 'error', 'message' => 'Không tìm thấy tài sản'], 404));
            }

            if ($asset->status !== 'new') {
                abort(response()->json([
                    'status' => 'error',
                    'message' => 'Chỉ có thể cấp phát thiết bị đang rảnh.'
                ], 400));
            }

            $hasOpenAssignment = Assignment::where('asset_id', $asset->id)
                ->whereIn('status', ['waiting', 'active'])
                ->exists();

            if ($hasOpenAssignment) {
                abort(response()->json([
                    'status' => 'error',
                    'message' => 'Thiết bị này đang có phiếu bàn giao chưa đóng.'
                ], 400));
            }

            $note = $request->admin_note ?: 'Admin xác nhận xuất kho theo yêu cầu mượn thiết bị.';
            if ((string) $asset->category_id !== (string) $assignmentRequest->category_id) {
                $note = trim($note . ' Admin điều chỉnh danh mục cấp phát theo nhu cầu thực tế của người mượn.');
            }
            $oldStatus = $asset->status;

            Assignment::create([
                'asset_id' => $asset->id,
                'user_id' => $assignmentRequest->requester_id,
                'assigned_by' => $request->user()->id,
                'request_id' => $assignmentRequest->id,
                'status' => 'waiting',
                'note' => $note,
                'assigned_at' => now(),
                'expected_return_date' => $assignmentRequest->expected_return_date,
            ]);

            $asset->update([
                'status' => 'waiting',
            ]);

            $assignmentRequest->update([
                'status' => 'approved',
                'category_id' => $asset->category_id,
                'admin_id' => $request->user()->id,
                'admin_note' => $request->admin_note,
                'admin_at' => now(),
            ]);

            DB::table('asset_histories')->insert([
                'asset_id' => $asset->id,
                'user_id' => $request->user()->id,
                'event_type' => 'assigned',
                'old_status' => $oldStatus,
                'new_status' => 'waiting',
                'note' => 'Cấp phát ' . $asset->asset_code . ' cho ' . ($assignmentRequest->requester?->name ?: 'nhân viên') . '. ' . $note,
                'created_at' => now(),
            ]);

            return $assignmentRequest;
        });

        $assignmentRequest->load([
            'requester:id,name,email,department_id',
            'requester.department:id,name',
            'requester.roles:id,name',
            'category:id,name',
            'manager:id,name',
            'admin:id,name',
        ]);

        $createdAssignment = Assignment::with('asset:id,asset_code,name')
            ->where('request_id', $assignmentRequest->id)
            ->orderByDesc('id')
            ->first();

        $this->notifications->notifyUser(
            $assignmentRequest->requester,
            'Admin da tao phieu ban giao',
            'Thiet bi ' . ($createdAssignment?->asset?->asset_code ?: '') . ' dang cho ban quet QR de xac nhan nhan tai san.',
            'success',
            ['request_id' => $assignmentRequest->id, 'assignment_id' => $createdAssignment?->id, 'asset_id' => $createdAssignment?->asset_id]
        );

        return response()->json([
            'status' => 'success',
            'message' => 'Đã cấp phát thiết bị và tạo phiếu bàn giao.',
            'data' => $assignmentRequest
        ], 200);
    }

    public function adminReject(Request $request, $id)
    {
        if (!$request->user()?->hasRole('admin')) {
            return response()->json([
                'status' => 'error',
                'message' => 'Bạn không có quyền từ chối cấp phát.'
            ], 403);
        }

        $request->validate([
            'admin_note' => 'required|string|min:5|max:1000',
        ], [
            'admin_note.required' => 'Vui lòng nhập lý do từ chối.',
            'admin_note.min' => 'Lý do từ chối cần tối thiểu 5 ký tự.',
        ]);

        $assignmentRequest = AssignmentRequest::with(['requester.department', 'category'])
            ->find($id);

        if (!$assignmentRequest) {
            return response()->json(['status' => 'error', 'message' => 'Không tìm thấy yêu cầu'], 404);
        }

        if ($assignmentRequest->status !== 'mgr_approved') {
            return response()->json([
                'status' => 'error',
                'message' => 'Chỉ có thể từ chối yêu cầu đang chờ admin cấp phát.'
            ], 400);
        }

        $assignmentRequest->update([
            'status' => 'rejected',
            'admin_id' => $request->user()->id,
            'admin_note' => $request->admin_note,
            'admin_at' => now(),
        ]);

        $assignmentRequest->load([
            'requester:id,name,email,department_id',
            'requester.department:id,name',
            'requester.roles:id,name',
            'category:id,name',
            'manager:id,name',
            'admin:id,name',
        ]);

        $this->notifications->notifyUser(
            $assignmentRequest->requester,
            'Yeu cau bi admin tu choi',
            'Ly do: ' . $assignmentRequest->admin_note,
            'warning',
            ['request_id' => $assignmentRequest->id]
        );

        return response()->json([
            'status' => 'success',
            'message' => 'Đã từ chối cấp phát thiết bị.',
            'data' => $assignmentRequest
        ], 200);
    }

    public function adminOutOfStock(Request $request, $id)
    {
        if (!$request->user()?->hasRole('admin')) {
            return response()->json([
                'status' => 'error',
                'message' => 'Ban khong co quyen chuyen yeu cau sang cho nhap kho.'
            ], 403);
        }

        $request->validate([
            'admin_note' => 'required|string|min:5|max:1000',
        ], [
            'admin_note.required' => 'Vui long nhap ghi chu cho nhap kho.',
            'admin_note.min' => 'Ghi chu can toi thieu 5 ky tu.',
        ]);

        $assignmentRequest = AssignmentRequest::with([
            'requester:id,name,email,department_id',
            'requester.department:id,name',
            'requester.roles:id,name',
            'category:id,name',
            'manager:id,name',
            'admin:id,name',
        ])->find($id);

        if (!$assignmentRequest) {
            return response()->json(['status' => 'error', 'message' => 'Khong tim thay yeu cau'], 404);
        }

        if ($assignmentRequest->status !== 'mgr_approved') {
            return response()->json([
                'status' => 'error',
                'message' => 'Chi co the chuyen yeu cau dang cho admin cap phat sang cho nhap kho.'
            ], 400);
        }

        $assignmentRequest->update([
            'status' => 'out_of_stock',
            'admin_id' => $request->user()->id,
            'admin_note' => $request->admin_note,
            'admin_at' => now(),
        ]);

        $assignmentRequest->load([
            'requester:id,name,email,department_id',
            'requester.department:id,name',
            'requester.roles:id,name',
            'category:id,name',
            'manager:id,name',
            'admin:id,name',
        ]);

        $this->notifications->notifyUser(
            $assignmentRequest->requester,
            'Yeu cau dang cho nhap kho',
            'Kho hien chua co thiet bi phu hop. Admin se cap phat khi co hang moi. Ghi chu: ' . $assignmentRequest->admin_note,
            'warning',
            ['request_id' => $assignmentRequest->id]
        );

        return response()->json([
            'status' => 'success',
            'message' => 'Da chuyen yeu cau sang trang thai cho nhap kho.',
            'data' => $assignmentRequest
        ], 200);
    }

    private function canView(Request $request, AssignmentRequest $assignmentRequest): bool
    {
        $user = $request->user();
        $role = $user?->roles()->value('name');

        if ($role === 'admin') {
            return true;
        }

        if ((string) $assignmentRequest->requester_id === (string) $user->id) {
            return true;
        }

        if ($role === 'manager' && $user->department_id) {
            return (string) $assignmentRequest->requester?->department_id === (string) $user->department_id;
        }

        return false;
    }

    private function canManagerReview(Request $request, AssignmentRequest $assignmentRequest): bool
    {
        $user = $request->user();
        $role = $user?->roles()->value('name');

        if ($role !== 'manager' || !$this->isPrimaryDepartmentManager($user)) {
            return false;
        }

        if ((string) $assignmentRequest->requester_id === (string) $user->id) {
            return false;
        }

        return (string) $assignmentRequest->requester?->department_id === (string) $user->department_id;
    }

    private function isPrimaryDepartmentManager($user): bool
    {
        if (!$user || !$user->department_id) {
            return false;
        }

        $user->loadMissing('department');

        return $user->department
            && (string) $user->department->manager_id === (string) $user->id;
    }
}
