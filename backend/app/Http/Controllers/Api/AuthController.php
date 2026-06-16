<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;
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
                'user' => $this->formatUser($user)
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

    public function profile(Request $request)
    {
        $user = $request->user();
        $user->load(['roles', 'department']);

        return response()->json([
            'status' => 'success',
            'data' => $this->formatUser($user)
        ], 200);
    }

    public function updateProfile(Request $request)
    {
        $user = $request->user();

        $request->validate([
            'name' => 'required|string|max:255',
            'email' => 'required|email|unique:users,email,' . $user->id,
            'phone' => ['nullable', 'regex:/^0[0-9]{9}$/'],
            'current_password' => 'nullable|required_with:password|string',
            'password' => 'nullable|string|min:6|confirmed',
        ], [
            'phone.regex' => 'Số điện thoại phải gồm 10 số và bắt đầu bằng 0.',
            'current_password.required_with' => 'Vui lòng nhập mật khẩu hiện tại trước khi đổi mật khẩu.',
            'password.confirmed' => 'Xác nhận mật khẩu mới không khớp.',
        ]);

        if ($request->filled('password') && !Hash::check($request->current_password, $user->password)) {
            return response()->json([
                'status' => 'error',
                'message' => 'Mật khẩu hiện tại không chính xác.'
            ], 422);
        }

        $data = $request->only(['name', 'email', 'phone']);

        if ($request->filled('password')) {
            $data['password'] = Hash::make($request->password);
        }

        $user->update($data);
        $user->load(['roles', 'department']);

        return response()->json([
            'status' => 'success',
            'message' => 'Cập nhật thông tin cá nhân thành công.',
            'data' => $this->formatUser($user)
        ], 200);
    }

    private function formatUser(User $user): array
    {
        return [
            'id' => $user->id,
            'name' => $user->name,
            'email' => $user->email,
            'phone' => $user->phone,
            'department_id' => $user->department_id,
            'department_name' => $user->department ? $user->department->name : null,
            'department_manager_id' => $user->department ? $user->department->manager_id : null,
            'is_department_approver' => $user->department
                ? (string) $user->department->manager_id === (string) $user->id
                : false,
            'roles' => $user->roles,
            'role' => $user->roles->first() ? $user->roles->first()->name : 'user',
        ];
    }
}
