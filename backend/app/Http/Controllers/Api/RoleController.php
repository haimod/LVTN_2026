<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Role; // Gọi Model Role

class RoleController extends Controller
{
    public function index()
    {
        // Lấy danh sách ID và Tên của các chức vụ
        $roles = Role::select('id', 'name')->get();

        return response()->json([
            'status' => 'success',
            'data' => $roles
        ], 200);
    }
}