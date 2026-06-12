<?php

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;

// BẮT BUỘC: Phải gọi tên AuthController ở đây để file route biết nó nằm ở đâu
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\UserController;
use App\Http\Controllers\Api\DepartmentController;
use App\Http\Controllers\Api\RoleController;
// --------------------------------------------------------
// 1. PUBLIC ROUTES (Những API không cần đăng nhập vẫn gọi được)
// --------------------------------------------------------
Route::post('/login', [AuthController::class, 'login']);


// --------------------------------------------------------
// 2. PROTECTED ROUTES (Những API bắt buộc phải có Token mới qua được)
// --------------------------------------------------------
// Middleware 'auth:sanctum' đóng vai trò như bảo vệ kiểm tra vé (token)
Route::middleware('auth:sanctum')->group(function () {
    
    // Đăng xuất
    Route::post('/logout', [AuthController::class, 'logout']);

    Route::get('/roles', [RoleController::class, 'index']); // PHẢI CÓ DÒNG NÀY THÌ MỚI HẾT 404
    Route::apiResource('users', UserController::class);
    Route::apiResource('departments', DepartmentController::class); 
    // Route có sẵn của Laravel để test lấy thông tin user đang đăng nhập
    Route::get('/user', function (Request $request) {
        return $request->user();
    });

});