<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use App\Models\Department;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
class UserController extends Controller
{
    // 1. LẤY DANH SÁCH NHÂN VIÊN
    public function index(Request $request)
    {
        // Khởi tạo query và Kéo theo thông tin phòng ban + chức vụ
        $query = User::with(['department', 'roles']);

        // XỬ LÝ LỌC
        if ($request->filled('search')) {
            $search = $request->search;
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', '%' . $search . '%')
                  ->orWhere('email', 'like', '%' . $search . '%')
                  ->orWhere('phone', 'like', '%' . $search . '%');
            });
        }

        if ($request->filled('department_id')) {
            $query->where('department_id', $request->department_id);
        }

        // Lọc theo chức vụ: Phải dùng whereHas vì roles nằm ở bảng khác
        if ($request->filled('role')) {
            $roleId = $request->role;
            $query->whereHas('roles', function ($q) use ($roleId) {
                $q->where('roles.id', $roleId);
            });
        }

        $users = $query->orderBy('created_at', 'desc')->get();

        return response()->json([
            'status' => 'success',
            'data' => $users
        ], 200);
    }

    // 2. THÊM NHÂN VIÊN
    public function store(Request $request)
    {
        $request->validate([
            'name' => 'required|string|max:255',
            'email' => 'required|email|unique:users,email',
            'password' => 'required|min:6',
            'department_id' => 'required|integer',
            'role_id' => 'required|integer', // Validate role_id
           'phone' => ['nullable', 'regex:/^0[0-9]{9}$/'],
            'is_active' => 'required|boolean'
        ]);

        // Tạo User
        $user = User::create([
            'name' => $request->name,
            'email' => $request->email,
            'password' => Hash::make($request->password),
            'department_id' => $request->department_id,
            'phone' => $request->phone,
            'is_active' => $request->is_active
        ]);

        // Gắn Role vào bảng trung gian
        $user->roles()->attach($request->role_id, ['model_type' => User::class]);

        // Tải thêm thông tin phòng ban và chức vụ để trả về luôn cho FE nếu cần
        $user->load(['department', 'roles']);

        return response()->json([
            'status' => 'success',
            'message' => 'Thêm nhân viên thành công!',
            'data' => $user
        ], 201);
    }

    // 3. XEM CHI TIẾT
    public function show($id)
    {
        // Load luôn cả phòng ban và role khi xem chi tiết
        $user = User::with(['department', 'roles'])->find($id);

        if (!$user) {
            return response()->json(['status' => 'error', 'message' => 'Không tìm thấy nhân viên'], 404);
        }

        return response()->json([
            'status' => 'success',
            'data' => $user
        ], 200);
    }

    // 4. CẬP NHẬT THÔNG TIN
    public function update(Request $request, $id)
    {
        $user = User::find($id);
        if (!$user) {
            return response()->json(['status' => 'error', 'message' => 'Không tìm thấy nhân viên'], 404);
        }

        $request->validate([
            'name' => 'required|string|max:255',
            'email' => 'required|email|unique:users,email,' . $id, 
            'department_id' => 'required|integer|exists:departments,id',
            'role_id' => 'required|integer|exists:roles,id',
            'phone' => ['nullable', 'regex:/^0[0-9]{9}$/'],
            'is_active' => 'required|boolean'
        ]);

        $isManagerOf = Department::where('manager_id', $id)->first();
        $currentRoleId = $user->roles()->value('roles.id');
        $roleChanged = (string) $currentRoleId !== (string) $request->role_id;
        $departmentChanged = (string) $user->department_id !== (string) $request->department_id;

        if ($isManagerOf && $roleChanged) {
            return response()->json([
                'status' => 'error',
                'message' => 'Hệ thống từ chối! Nhân sự này đang là người duyệt của [' . $isManagerOf->name . ']. Vui lòng sang Quản lý Phòng ban bổ nhiệm người khác thay thế trước khi đổi chức vụ.'
            ], 400);
        }

        if ($isManagerOf && $departmentChanged) {
            return response()->json([
                'status' => 'error',
                'message' => 'He thong tu choi! Nhan su nay dang la nguoi duyet cua [' . $isManagerOf->name . ']. Vui long bo nhiem nguoi duyet khac truoc khi chuyen phong ban.'
            ], 400);
        }

        if ($isManagerOf && !$request->boolean('is_active')) {
            return response()->json([
                'status' => 'error',
                'message' => 'Hệ thống từ chối! Nhân sự này đang là người duyệt của [' . $isManagerOf->name . ']. Vui lòng sang Quản lý Phòng ban bổ nhiệm người khác thay thế trước khi khóa tài khoản.'
            ], 400);
        }

        // Bỏ password và role_id ra khỏi mảng cập nhật bảng users
        if (!$request->boolean('is_active')) {
            $blockMessage = $this->getAccountLockBlockMessage($user->id);
            if ($blockMessage) {
                return response()->json([
                    'status' => 'error',
                    'message' => $blockMessage
                ], 400);
            }
        }

        $dataUpdate = $request->except(['password', 'role_id']); 
        
        if ($request->filled('password')) { 
            $dataUpdate['password'] = Hash::make($request->password); 
        }

        $user->update($dataUpdate);

        if ($departmentChanged) {
            $this->syncActiveAssetDepartment($user->id, (int) $request->department_id);
        }

        // Cập nhật chức vụ mới vào bảng trung gian (xóa cũ, đắp mới)
        $user->roles()->syncWithPivotValues([$request->role_id], ['model_type' => User::class]);
        if (!$request->boolean('is_active')) {
            $user->tokens()->delete();
        }
        $user->load(['department', 'roles']);

        return response()->json([
            'status' => 'success',
            'message' => 'Cập nhật thông tin thành công!',
            'data' => $user
        ], 200);
    }

    // 5. KHÓA TÀI KHOẢN
    public function destroy($id)
    {
        $user = User::find($id);
        if (!$user) {
            return response()->json(['status' => 'error', 'message' => 'Không tìm thấy nhân viên'], 404);
        }

        $isManagerOf = Department::where('manager_id', $id)->first();
        if ($isManagerOf) {
            return response()->json([
                'status' => 'error',
                'message' => 'Hệ thống từ chối! Nhân sự này đang là người duyệt của [' . $isManagerOf->name . ']. Vui lòng sang Quản lý Phòng ban bổ nhiệm người khác thay thế trước khi khóa tài khoản.'
            ], 400);
        }

        $blockMessage = $this->getAccountLockBlockMessage($user->id);
        if ($blockMessage) {
            return response()->json([
                'status' => 'error',
                'message' => $blockMessage
            ], 400);
        }

        $user->update(['is_active' => 0]);
        $user->tokens()->delete();
        $user->load(['department', 'roles']);

        return response()->json([
            'status' => 'success',
            'message' => 'Đã khóa tài khoản thành công!',
            'data' => $user
        ], 200);
    }

    private function getAccountLockBlockMessage(int $userId): ?string
    {
        $activeAssignmentCount = DB::table('assignments')
            ->where('user_id', $userId)
            ->whereIn('status', ['waiting', 'active'])
            ->count();

        if ($activeAssignmentCount > 0) {
            return 'Khong the khoa tai khoan: nhan su van con ' . $activeAssignmentCount . ' phieu ban giao chua dong. Vui long thu hoi/xu ly tai san truoc.';
        }

        if (Schema::hasTable('maintenance_records')) {
            $pendingMaintenanceCount = DB::table('maintenance_records')
                ->where('reported_by', $userId)
                ->whereIn('status', ['pending', 'repairing'])
                ->count();

            if ($pendingMaintenanceCount > 0) {
                return 'Khong the khoa tai khoan: nhan su con ' . $pendingMaintenanceCount . ' phieu bao tri chua dong. Vui long xu ly cong no bao tri truoc.';
            }
        }

        return null;
    }

    private function syncActiveAssetDepartment(int $userId, int $departmentId): void
    {
        $assetIds = DB::table('assignments')
            ->where('user_id', $userId)
            ->where('status', 'active')
            ->pluck('asset_id');

        if ($assetIds->isEmpty()) {
            return;
        }

        DB::table('assets')
            ->whereIn('id', $assetIds)
            ->update([
                'department_id' => $departmentId,
                'updated_at' => now(),
            ]);
    }
}
