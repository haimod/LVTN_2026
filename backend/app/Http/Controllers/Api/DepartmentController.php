<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Department;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class DepartmentController extends Controller
{
    // 1. LẤY DANH SÁCH (Có đếm số nhân sự và thông tin trưởng phòng)
// 1. LẤY DANH SÁCH (Đã thêm Search và Filter)
    public function index(Request $request)
    {
        // 1. Khởi tạo Query với Eager Loading
        $query = Department::with('manager:id,name')->withCount('users');

        // 2. XỬ LÝ LỌC (SEARCH)
        // Tìm theo Tên, Mã code hoặc Mô tả
        if ($request->filled('search')) {
            $search = $request->search;
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', '%' . $search . '%')
                  ->orWhere('code', 'like', '%' . $search . '%')
                  ->orWhere('description', 'like', '%' . $search . '%');
            });
        }

        // 3. XỬ LÝ LỌC THEO TRƯỞNG PHÒNG
        if ($request->filled('manager_id')) {
            $query->where('manager_id', $request->manager_id);
        }

        // 4. Thực thi
        $departments = $query->orderBy('created_at', 'desc')->get();

        return response()->json([
            'status' => 'success',
            'data' => $departments
        ], 200);
    }

    // 2. THÊM PHÒNG BAN
    public function store(Request $request)
    {
        $request->validate([
            'name'        => 'required|string|max:191|unique:departments,name',
            'code'        => 'required|string|max:50|unique:departments,code',
            'description' => 'nullable|string',
            // Chỉ cho phép chọn manager đang hoạt động (is_active = 1)
            'manager_id'  => 'nullable|integer|exists:users,id,is_active,1',
            'upgrade_role'=> 'nullable|boolean'
        ], [
            'manager_id.exists' => 'Nhân sự này không tồn tại hoặc tài khoản đang bị khóa!',
        ]);

        $manager = $request->manager_id ? User::find($request->manager_id) : null;
        $managerNeedsUpgrade = $manager && !$manager->hasAnyRole(['manager', 'admin']);

        if ($managerNeedsUpgrade && !$request->boolean('upgrade_role')) {
            return response()->json([
                'status' => 'error',
                'message' => 'Nhân sự được chọn làm người duyệt chưa có quyền Manager. Vui lòng đồng ý nâng quyền trước khi lưu phòng ban.'
            ], 400);
        }

        $department = DB::transaction(function () use ($request, $manager, $managerNeedsUpgrade) {
            if ($managerNeedsUpgrade && $request->boolean('upgrade_role')) {
                $manager->syncRoles(['manager']);
            }

            return Department::create([
                'name'        => $request->name,
                'code'        => $request->code,
                'description' => $request->description,
                'manager_id'  => $request->manager_id
            ]);
        });

        $department->load('manager:id,name')->loadCount('users');

        return response()->json([
            'status' => 'success',
            'message' => 'Thêm phòng ban thành công',
            'data' => $department
        ], 201);
    }

    // 3. XEM CHI TIẾT
    public function show($id)
    {
        $department = Department::with('manager:id,name,email,phone')->find($id);
        
        if (!$department) {
            return response()->json(['status' => 'error', 'message' => 'Không tìm thấy phòng ban'], 404);
        }
        
        return response()->json([
            'status' => 'success',
            'data' => $department
        ], 200);
    }

    // 4. CẬP NHẬT (Có tính năng nâng quyền trưởng phòng)
  public function update(Request $request, $id)
    {
        $department = Department::find($id);
        
        if (!$department) {
            return response()->json(['status' => 'error', 'message' => 'Không tìm thấy phòng ban'], 404);
        }

        $request->validate([
            'name'        => 'required|string|max:191|unique:departments,name,' . $id,
            'code'        => 'required|string|max:50|unique:departments,code,' . $id,
            'description' => 'nullable|string',
            'manager_id'  => 'nullable|integer|exists:users,id,is_active,1',
            'upgrade_role'=> 'nullable|boolean' // Nhận flag nâng quyền từ Modal confirm
        ], [
            'manager_id.exists' => 'Nhân sự này không tồn tại hoặc tài khoản đang bị khóa!',
        ]);

        // Người duyệt phải có role manager/admin để đồng bộ với QLNS.
        $newManagerId = $request->manager_id;
        $newManager = $newManagerId ? User::find($newManagerId) : null;
        $managerNeedsUpgrade = $newManager && !$newManager->hasAnyRole(['manager', 'admin']);

        if ($managerNeedsUpgrade && !$request->boolean('upgrade_role')) {
            return response()->json([
                'status' => 'error',
                'message' => 'Nhân sự được chọn làm người duyệt chưa có quyền Manager. Vui lòng đồng ý nâng quyền trước khi lưu phòng ban.'
            ], 400);
        }

        DB::transaction(function () use ($department, $request, $newManager, $newManagerId, $managerNeedsUpgrade) {
            if ($managerNeedsUpgrade && $request->boolean('upgrade_role')) {
                $newManager->syncRoles(['manager']);
            }

            $department->update([
                'name'        => $request->name,
                'code'        => $request->code,
                'description' => $request->description,
                'manager_id'  => $newManagerId
            ]);
        });

        $department->load('manager:id,name')->loadCount('users');

        return response()->json([
            'status' => 'success',
            'message' => 'Cập nhật phòng ban thành công!',
            'data' => $department
        ], 200);
    }
    // 5. XÓA (Bảo vệ dữ liệu không bị "mồ côi")
    public function destroy($id)
    {
        $department = Department::find($id);
        
        if (!$department) {
            return response()->json(['status' => 'error', 'message' => 'Không tìm thấy phòng ban'], 404);
        }

        // Chặn xóa nếu còn nhân viên
        $userCount = User::where('department_id', $id)->count();
        if ($userCount > 0) {
            return response()->json([
                'status' => 'error', 
                'message' => "Không thể xóa! Đang có {$userCount} nhân viên thuộc phòng ban này."
            ], 400); 
        }

        // Chặn xóa nếu còn tài sản
        $assetCount = DB::table('assets')->where('department_id', $id)->count();
        if ($assetCount > 0) {
            return response()->json([
                'status' => 'error', 
                'message' => "Không thể xóa! Phòng ban này đang quản lý {$assetCount} tài sản."
            ], 400);
        }

        $department->delete();

        return response()->json([
            'status' => 'success',
            'message' => 'Đã xóa phòng ban thành công!'
        ], 200);
    }
}
