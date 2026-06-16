<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\Request;

class ManagerEmployeeController extends Controller
{
    public function index(Request $request)
    {
        $manager = $request->user();
        $role = $manager?->roles()->value('name');

        if ($role !== 'manager') {
            return response()->json([
                'status' => 'error',
                'message' => 'Bạn không có quyền xem danh sách nhân viên phòng ban.'
            ], 403);
        }

        if (!$manager->department_id) {
            return response()->json([
                'status' => 'success',
                'data' => []
            ], 200);
        }

        $query = User::with(['department:id,name', 'roles:id,name'])
            ->where('department_id', $manager->department_id)
            ->where('id', '!=', $manager->id);

        if ($request->filled('search')) {
            $search = $request->search;
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                    ->orWhere('email', 'like', "%{$search}%")
                    ->orWhere('phone', 'like', "%{$search}%");
            });
        }

        if ($request->filled('status')) {
            $query->where('is_active', $request->status === 'active' ? 1 : 0);
        }

        $employees = $query->orderBy('name')->get();

        return response()->json([
            'status' => 'success',
            'data' => $employees
        ], 200);
    }
}
