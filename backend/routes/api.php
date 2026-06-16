<?php

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;

// BẮT BUỘC: Phải gọi tên AuthController ở đây để file route biết nó nằm ở đâu
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\UserController;
use App\Http\Controllers\Api\DepartmentController;
use App\Http\Controllers\Api\RoleController;
use App\Http\Controllers\Api\AssetController;
use App\Http\Controllers\Api\AssetHistoryController;
use App\Http\Controllers\Api\CategoryController;
use App\Http\Controllers\Api\AssignmentRequestController;
use App\Http\Controllers\Api\BorrowHistoryController;
use App\Http\Controllers\Api\EmergencyAllocationController;
use App\Http\Controllers\Api\ManagerEmployeeController;
use App\Http\Controllers\Api\NotificationController;
use App\Http\Controllers\Api\HandoverController;
use App\Http\Controllers\Api\MaintenanceRecordController;
use App\Http\Controllers\Api\LostReportController;
use App\Http\Controllers\Api\LiquidationController;
use App\Http\Controllers\Api\ReturnRequestController;
use App\Http\Controllers\Api\ReportController;
use App\Http\Controllers\Api\DashboardController;
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
    Route::get('/profile', [AuthController::class, 'profile']);
    Route::put('/profile', [AuthController::class, 'updateProfile']);

    Route::middleware('role:admin')->group(function () {
        Route::get('/roles', [RoleController::class, 'index']); // PHẢI CÓ DÒNG NÀY THÌ MỚI HẾT 404
        Route::apiResource('users', UserController::class);
        Route::apiResource('departments', DepartmentController::class);
        Route::apiResource('categories', CategoryController::class)->only(['store', 'update', 'destroy']);
    });

    Route::apiResource('categories', CategoryController::class)->only(['index', 'show']);

    // API Quản lý Tài sản
    Route::get('/assets/export', [AssetController::class, 'export'])->middleware('role:admin');
    Route::apiResource('assets', AssetController::class);
    Route::patch('/assets/{id}/dispose', [AssetController::class, 'dispose'])->middleware('role:admin');
    Route::get('/assets/{id}/histories', [AssetHistoryController::class, 'index'])->middleware('role:admin');
    Route::apiResource('assignment-requests', AssignmentRequestController::class)->only(['index', 'store', 'show']);
    Route::patch('/assignment-requests/{id}/manager-approve', [AssignmentRequestController::class, 'managerApprove']);
    Route::patch('/assignment-requests/{id}/manager-reject', [AssignmentRequestController::class, 'managerReject']);
    Route::patch('/assignment-requests/{id}/admin-fulfill', [AssignmentRequestController::class, 'adminFulfill'])->middleware('role:admin');
    Route::patch('/assignment-requests/{id}/admin-reject', [AssignmentRequestController::class, 'adminReject'])->middleware('role:admin');
    Route::patch('/assignment-requests/{id}/admin-out-of-stock', [AssignmentRequestController::class, 'adminOutOfStock'])->middleware('role:admin');
    Route::get('/emergency-allocations', [EmergencyAllocationController::class, 'index'])->middleware('role:admin');
    Route::post('/emergency-allocations', [EmergencyAllocationController::class, 'store'])->middleware('role:admin');
    Route::get('/borrow-history', [BorrowHistoryController::class, 'index']);
    Route::get('/manager/employees', [ManagerEmployeeController::class, 'index']);
    Route::get('/notifications', [NotificationController::class, 'index']);
    Route::patch('/notifications/read-all', [NotificationController::class, 'markAllAsRead']);
    Route::patch('/notifications/{id}/read', [NotificationController::class, 'markAsRead']);
    Route::post('/handover-sessions', [HandoverController::class, 'createSession']);
    Route::post('/handover-sessions/{token}/confirm', [HandoverController::class, 'confirm']);
    Route::get('/maintenance-records', [MaintenanceRecordController::class, 'index'])->middleware('role:admin');
    Route::post('/maintenance-records/report', [MaintenanceRecordController::class, 'report']);
    Route::patch('/maintenance-records/{id}/receive', [MaintenanceRecordController::class, 'receive'])->middleware('role:admin');
    Route::patch('/maintenance-records/{id}/complete', [MaintenanceRecordController::class, 'complete'])->middleware('role:admin');
    Route::get('/lost-reports', [LostReportController::class, 'index'])->middleware('role:admin');
    Route::post('/lost-reports/report', [LostReportController::class, 'report']);
    Route::patch('/lost-reports/{id}/resolve', [LostReportController::class, 'resolve'])->middleware('role:admin');
    Route::get('/return-requests', [ReturnRequestController::class, 'index'])->middleware('role:admin');
    Route::post('/return-requests/request', [ReturnRequestController::class, 'requestReturn']);
    Route::patch('/return-requests/{id}/confirm', [ReturnRequestController::class, 'confirm'])->middleware('role:admin');
    Route::get('/liquidations', [LiquidationController::class, 'index'])->middleware('role:admin');
    Route::get('/reports/overview', [ReportController::class, 'overview'])->middleware('role:admin');
    Route::get('/reports/overview/export', [ReportController::class, 'exportOverview'])->middleware('role:admin');
    Route::get('/dashboard/user', [DashboardController::class, 'userOverview']);
    Route::get('/dashboard/manager', [DashboardController::class, 'managerOverview'])->middleware('role:manager');
    Route::get('/dashboard/admin', [DashboardController::class, 'adminOverview'])->middleware('role:admin');
    // Route có sẵn của Laravel để test lấy thông tin user đang đăng nhập
    Route::get('/user', function (Request $request) {
        return $request->user();
    });

});
