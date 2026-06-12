<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use App\Models\User;

class AuthController extends Controller
{
    public function login(Request $request)
    {
        $request->validate([
            'email' => 'required|email',
            'password' => 'required',
        ]);

        $credentials = $request->only('email', 'password');
        
        if (Auth::attempt($credentials)) {
            /** @var \App\Models\User|\Laravel\Sanctum\HasApiTokens $user */
            $user = Auth::user();

            if ($user->is_active == 0) {
                Auth::logout(); 
                return response()->json([
                    'status' => 'error',
                    'message' => 'Tài khoản của bạn đã bị khóa hoặc ngừng hoạt động.'
                ], 403); 
            }

            // 1. TẢI THÊM THÔNG TIN CHỨC VỤ VÀ PHÒNG BAN TỪ BẢNG TRUNG GIAN
            $user->load(['roles', 'department']);

            $token = $user->createToken('auth_token')->plainTextToken;

            return response()->json([
                'status' => 'success',
                'message' => 'Đăng nhập thành công.',
                'access_token' => $token,
                'token_type' => 'Bearer',
                'user' => [
                    'id' => $user->id,
                    'name' => $user->name,
                    'email' => $user->email,
                    'department_id' => $user->department_id,
                    // 2. ĐÍNH KÈM THÊM THÔNG TIN VÀO ĐÂY
                    'department_name' => $user->department ? $user->department->name : null,
                    'roles' => $user->roles, // Trả về toàn bộ mảng chức vụ
                    'role' => $user->roles->first() ? $user->roles->first()->name : 'user' // Lấy ra cái tên đầu tiên (vd: 'admin') để React cực kỳ dễ check if-else
                ]
            ], 200); 
        }

        return response()->json([
            'status' => 'error',
            'message' => 'Email hoặc mật khẩu không chính xác.'
        ], 401); 
    }

    public function logout(Request $request)
    {
        $request->user()->currentAccessToken()->delete();

        return response()->json([
            'status' => 'success',
            'message' => 'Đăng xuất thành công.'
        ], 200);
    }
}