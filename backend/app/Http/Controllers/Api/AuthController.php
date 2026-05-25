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
        // 1. Kiểm tra dữ liệu đầu vào (Validate)
        // Đảm bảo client phải truyền lên đầy đủ email (đúng định dạng) và password
        $request->validate([
            'email' => 'required|email',
            'password' => 'required',
        ]);

        // 2. Xác thực tài khoản
        // Auth::attempt sẽ tự lấy email để tìm user, lấy password truyền lên 
        // để mã hóa thử và so sánh với chuỗi mật khẩu đã mã hóa trong database.
        $credentials = $request->only('email', 'password');
        
        if (Auth::attempt($credentials)) {
            /** @var \App\Models\User|\Laravel\Sanctum\HasApiTokens $user */

            $user = Auth::user();

            // 3. Kiểm tra trạng thái hoạt động (Nghiệp vụ bổ sung từ database của bạn)
            // Nếu tài khoản bị khóa (is_active = 0), không cho phép đăng nhập tiếp
            if ($user->is_active == 0) {
                Auth::logout(); // Hủy phiên làm việc vừa khớp
                return response()->json([
                    'status' => 'error',
                    'message' => 'Tài khoản của bạn đã bị khóa hoặc ngừng hoạt động.'
                ], 403); // Mã lỗi 403: Forbidden (Bị cấm truy cập)
            }

            // 4. Khởi tạo Token bằng Laravel Sanctum
            // Tạo ra một chuỗi mã hóa ("chìa khóa") lưu vào bảng personal_access_tokens
            $token = $user->createToken('auth_token')->plainTextToken;

            // 5. Trả dữ liệu về cho Frontend
            // Trả về chuỗi token này kèm theo thông tin user để React lưu trữ và sử dụng
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
                ]
            ], 200); // Mã 200: OK thành công
        }

        // 6. Trả về lỗi nếu thông tin đăng nhập sai
        return response()->json([
            'status' => 'error',
            'message' => 'Email hoặc mật khẩu không chính xác.'
        ], 401); // Mã lỗi 401: Unauthorized (Không có quyền truy cập do sai thông tin)
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
