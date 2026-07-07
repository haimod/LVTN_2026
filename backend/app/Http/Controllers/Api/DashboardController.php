<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class DashboardController extends Controller
{
    public function userOverview(Request $request)
    {
        $user = $request->user();

        if (!$user || $user->hasRole('admin')) {
            return response()->json([
                'status' => 'error',
                'message' => 'Ban khong co quyen xem tong quan nhan vien.',
            ], 403);
        }

        return response()->json([
            'status' => 'success',
            'data' => [
                'request_summary' => $this->userRequestSummary($user->id),
                'assignment_summary' => $this->userAssignmentSummary($user->id),
                'current_assets' => $this->userCurrentAssets($user->id),
                'recent_requests' => $this->userRecentRequests($user->id),
            ],
        ]);
    }

    public function managerOverview(Request $request)
    {
        $user = $request->user();

        if (!$user || !$user->hasRole('manager')) {
            return response()->json([
                'status' => 'error',
                'message' => 'Ban khong co quyen xem tong quan truong phong.',
            ], 403);
        }

        $isPrimaryApprover = $this->isPrimaryDepartmentManager($user);

        return response()->json([
            'status' => 'success',
            'data' => [
                'is_department_approver' => $isPrimaryApprover,
                'approval_summary' => $this->managerApprovalSummary($user, $isPrimaryApprover),
                'department_employee_count' => $this->departmentEmployeeCount($user->department_id),
                'department_active_assignments' => $this->departmentActiveAssignments($user->department_id),
                'department_asset_statuses' => $this->departmentAssetStatuses($user->department_id),
                'pending_requests' => $isPrimaryApprover ? $this->managerPendingRequests($user) : [],
                'own_assignment_summary' => $this->userAssignmentSummary($user->id),
                'own_current_assets' => $this->userCurrentAssets($user->id, 3),
            ],
        ]);
    }

    public function adminOverview(Request $request)
    {
        if (!$request->user()?->hasRole('admin')) {
            return response()->json([
                'status' => 'error',
                'message' => 'Ban khong co quyen xem tong quan admin.',
            ], 403);
        }

        return response()->json([
            'status' => 'success',
            'data' => [
                'work_items' => $this->workItems(),
                'asset_statuses' => $this->assetStatuses(),
                'recent_activities' => $this->recentActivities(),
                'quick_links' => $this->quickLinks(),
            ],
        ]);
    }

    private function userRequestSummary(int $userId): array
    {
        $summary = [
            'total' => 0,
            'pending' => 0,
            'mgr_approved' => 0,
            'approved' => 0,
            'rejected' => 0,
            'out_of_stock' => 0,
        ];

        if (!Schema::hasTable('assignment_requests')) {
            return $summary;
        }

        $rows = DB::table('assignment_requests')
            ->select('status', DB::raw('COUNT(*) as total'))
            ->where('requester_id', $userId)
            ->groupBy('status')
            ->get();

        foreach ($rows as $row) {
            $summary['total'] += (int) $row->total;

            if (array_key_exists($row->status, $summary)) {
                $summary[$row->status] = (int) $row->total;
            }
        }

        return $summary;
    }

    private function userAssignmentSummary(int $userId): array
    {
        $summary = [
            'total' => 0,
            'waiting' => 0,
            'active' => 0,
            'returned' => 0,
            'return_waiting' => 0,
        ];

        if (!Schema::hasTable('assignments')) {
            return $summary;
        }

        $rows = DB::table('assignments')
            ->select('status', DB::raw('COUNT(*) as total'))
            ->where('user_id', $userId)
            ->groupBy('status')
            ->get();

        foreach ($rows as $row) {
            $summary['total'] += (int) $row->total;

            if (array_key_exists($row->status, $summary)) {
                $summary[$row->status] = (int) $row->total;
            }
        }

        if (Schema::hasColumn('assignments', 'return_requested_at')) {
            $summary['return_waiting'] = (int) DB::table('assignments')
                ->where('user_id', $userId)
                ->where('status', 'active')
                ->whereNotNull('return_requested_at')
                ->whereNull('returned_at')
                ->count();
        }

        return $summary;
    }

    private function userCurrentAssets(int $userId, int $limit = 6): array
    {
        if (!Schema::hasTable('assignments') || !Schema::hasTable('assets')) {
            return [];
        }

        $returnRequestedSelect = Schema::hasColumn('assignments', 'return_requested_at')
            ? 'assignments.return_requested_at'
            : DB::raw('NULL as return_requested_at');
        $expectedReturnDateSelect = Schema::hasColumn('assignments', 'expected_return_date')
            ? 'assignments.expected_return_date'
            : DB::raw('NULL as expected_return_date');

        return DB::table('assignments')
            ->join('assets', 'assignments.asset_id', '=', 'assets.id')
            ->leftJoin('categories', 'assets.category_id', '=', 'categories.id')
            ->leftJoin('users as assigned_users', 'assignments.assigned_by', '=', 'assigned_users.id')
            ->where('assignments.user_id', $userId)
            ->whereIn('assignments.status', ['waiting', 'active'])
            ->orderByDesc('assignments.assigned_at')
            ->orderByDesc('assignments.id')
            ->limit($limit)
            ->select([
                'assignments.id',
                'assignments.status',
                'assignments.note',
                'assignments.assigned_at',
                $expectedReturnDateSelect,
                'assignments.confirmed_at',
                $returnRequestedSelect,
                'assets.id as asset_id',
                'assets.uuid as asset_uuid',
                'assets.asset_code',
                'assets.name as asset_name',
                'assets.status as asset_status',
                'assets.image_path',
                'categories.name as category_name',
                'assigned_users.name as assigned_by_name',
            ])
            ->get()
            ->map(fn ($item) => [
                'id' => $item->id,
                'status' => $item->status,
                'note' => $item->note,
                'assigned_at' => $item->assigned_at,
                'expected_return_date' => $item->expected_return_date,
                'confirmed_at' => $item->confirmed_at,
                'return_requested_at' => $item->return_requested_at,
                'asset_id' => $item->asset_id,
                'asset_uuid' => $item->asset_uuid,
                'asset_code' => $item->asset_code,
                'asset_name' => $item->asset_name,
                'asset_status' => $item->asset_status,
                'image_path' => $item->image_path,
                'category_name' => $item->category_name,
                'assigned_by_name' => $item->assigned_by_name,
            ])
            ->values()
            ->all();
    }

    private function userRecentRequests(int $userId): array
    {
        if (!Schema::hasTable('assignment_requests')) {
            return [];
        }

        $expectedReturnDateSelect = Schema::hasColumn('assignment_requests', 'expected_return_date')
            ? 'assignment_requests.expected_return_date'
            : DB::raw('NULL as expected_return_date');

        return DB::table('assignment_requests')
            ->leftJoin('categories', 'assignment_requests.category_id', '=', 'categories.id')
            ->where('assignment_requests.requester_id', $userId)
            ->orderByDesc('assignment_requests.created_at')
            ->orderByDesc('assignment_requests.id')
            ->limit(6)
            ->select([
                'assignment_requests.id',
                'assignment_requests.status',
                'assignment_requests.reason',
                'assignment_requests.requested_specification',
                $expectedReturnDateSelect,
                'assignment_requests.manager_note',
                'assignment_requests.admin_note',
                'assignment_requests.created_at',
                'categories.name as category_name',
            ])
            ->get()
            ->map(fn ($item) => [
                'id' => $item->id,
                'status' => $item->status,
                'reason' => $item->reason,
                'requested_specification' => $item->requested_specification,
                'expected_return_date' => $item->expected_return_date,
                'manager_note' => $item->manager_note,
                'admin_note' => $item->admin_note,
                'created_at' => $item->created_at,
                'category_name' => $item->category_name,
            ])
            ->values()
            ->all();
    }

    private function managerApprovalSummary($user, bool $isPrimaryApprover): array
    {
        $summary = [
            'total' => 0,
            'pending' => 0,
            'mgr_approved' => 0,
            'rejected' => 0,
        ];

        if (!$isPrimaryApprover || !$user->department_id || !Schema::hasTable('assignment_requests') || !Schema::hasTable('users')) {
            return $summary;
        }

        $rows = DB::table('assignment_requests')
            ->join('users', 'assignment_requests.requester_id', '=', 'users.id')
            ->select('assignment_requests.status', DB::raw('COUNT(*) as total'))
            ->where('users.department_id', $user->department_id)
            ->where('users.id', '!=', $user->id)
            ->groupBy('assignment_requests.status')
            ->get();

        foreach ($rows as $row) {
            $summary['total'] += (int) $row->total;

            if (array_key_exists($row->status, $summary)) {
                $summary[$row->status] = (int) $row->total;
            }
        }

        return $summary;
    }

    private function managerPendingRequests($user): array
    {
        if (!$user->department_id || !Schema::hasTable('assignment_requests') || !Schema::hasTable('users')) {
            return [];
        }

        $expectedReturnDateSelect = Schema::hasColumn('assignment_requests', 'expected_return_date')
            ? 'assignment_requests.expected_return_date'
            : DB::raw('NULL as expected_return_date');

        return DB::table('assignment_requests')
            ->join('users', 'assignment_requests.requester_id', '=', 'users.id')
            ->leftJoin('categories', 'assignment_requests.category_id', '=', 'categories.id')
            ->where('users.department_id', $user->department_id)
            ->where('users.id', '!=', $user->id)
            ->where('assignment_requests.status', 'pending')
            ->orderByDesc('assignment_requests.created_at')
            ->orderByDesc('assignment_requests.id')
            ->limit(6)
            ->select([
                'assignment_requests.id',
                'assignment_requests.reason',
                'assignment_requests.requested_specification',
                $expectedReturnDateSelect,
                'assignment_requests.created_at',
                'users.name as requester_name',
                'users.email as requester_email',
                'categories.name as category_name',
            ])
            ->get()
            ->map(fn ($item) => [
                'id' => $item->id,
                'reason' => $item->reason,
                'requested_specification' => $item->requested_specification,
                'expected_return_date' => $item->expected_return_date,
                'created_at' => $item->created_at,
                'requester_name' => $item->requester_name,
                'requester_email' => $item->requester_email,
                'category_name' => $item->category_name,
            ])
            ->values()
            ->all();
    }

    private function departmentEmployeeCount($departmentId): int
    {
        if (!$departmentId || !Schema::hasTable('users') || !Schema::hasColumn('users', 'department_id')) {
            return 0;
        }

        return (int) DB::table('users')
            ->where('department_id', $departmentId)
            ->count();
    }

    private function departmentActiveAssignments($departmentId): int
    {
        if (!$departmentId || !Schema::hasTable('assignments') || !Schema::hasTable('users')) {
            return 0;
        }

        return (int) DB::table('assignments')
            ->join('users', 'assignments.user_id', '=', 'users.id')
            ->where('users.department_id', $departmentId)
            ->where('assignments.status', 'active')
            ->count();
    }

    private function departmentAssetStatuses($departmentId): array
    {
        if (!$departmentId || !Schema::hasTable('assets') || !Schema::hasColumn('assets', 'department_id')) {
            return [];
        }

        return DB::table('assets')
            ->select('status', DB::raw('COUNT(*) as total'))
            ->where('department_id', $departmentId)
            ->groupBy('status')
            ->orderBy('status')
            ->get()
            ->map(fn ($item) => [
                'status' => $item->status,
                'total' => (int) $item->total,
            ])
            ->values()
            ->all();
    }

    private function workItems(): array
    {
        return [
            [
                'key' => 'borrow_waiting_admin',
                'title' => 'Yeu cau cho cap phat',
                'count' => $this->countTable('assignment_requests', ['status' => 'mgr_approved']),
                'path' => '/admin/borrow-requests',
                'level' => 'processing',
            ],
            [
                'key' => 'handover_waiting_confirm',
                'title' => 'Cho user xac nhan QR',
                'count' => $this->countTable('assignments', ['status' => 'waiting']),
                'path' => '/admin/borrow-requests',
                'level' => 'warning',
            ],
            [
                'key' => 'maintenance_pending',
                'title' => 'Bao hong cho tiep nhan',
                'count' => $this->countTable('maintenance_records', ['status' => 'pending']),
                'path' => '/maintenance/tickets',
                'level' => 'warning',
            ],
            [
                'key' => 'lost_pending',
                'title' => 'Bao mat cho xu ly',
                'count' => $this->countTable('lost_reports', ['status' => 'pending']),
                'path' => '/maintenance/blacklist',
                'level' => 'danger',
            ],
            [
                'key' => 'return_waiting_admin',
                'title' => 'Yeu cau tra cho nhan',
                'count' => $this->returnWaitingCount(),
                'path' => '/retrieval/requests',
                'level' => 'success',
            ],
        ];
    }

    private function assetStatuses(): array
    {
        if (!Schema::hasTable('assets')) {
            return [];
        }

        return DB::table('assets')
            ->select('status', DB::raw('COUNT(*) as total'))
            ->groupBy('status')
            ->orderBy('status')
            ->get()
            ->map(fn ($item) => [
                'status' => $item->status,
                'total' => (int) $item->total,
            ])
            ->values()
            ->all();
    }

    private function recentActivities(): array
    {
        if (!Schema::hasTable('asset_histories')) {
            return [];
        }

        return DB::table('asset_histories')
            ->leftJoin('assets', 'asset_histories.asset_id', '=', 'assets.id')
            ->leftJoin('users', 'asset_histories.user_id', '=', 'users.id')
            ->orderByDesc('asset_histories.created_at')
            ->orderByDesc('asset_histories.id')
            ->limit(10)
            ->select([
                'asset_histories.id',
                'asset_histories.event_type',
                'asset_histories.old_status',
                'asset_histories.new_status',
                'asset_histories.note',
                'asset_histories.created_at',
                'assets.asset_code',
                'assets.name as asset_name',
                'users.name as user_name',
            ])
            ->get()
            ->map(fn ($item) => [
                'id' => $item->id,
                'event_type' => $item->event_type,
                'old_status' => $item->old_status,
                'new_status' => $item->new_status,
                'note' => $item->note,
                'created_at' => $item->created_at,
                'asset_code' => $item->asset_code,
                'asset_name' => $item->asset_name,
                'user_name' => $item->user_name,
            ])
            ->values()
            ->all();
    }

    private function quickLinks(): array
    {
        return [
            ['key' => 'borrow', 'title' => 'Duyet muon & cap phat', 'path' => '/admin/borrow-requests'],
            ['key' => 'emergency', 'title' => 'Cap phat khan cap', 'path' => '/admin/emergency-allocations'],
            ['key' => 'maintenance', 'title' => 'Tiep nhan su co', 'path' => '/maintenance/tickets'],
            ['key' => 'lost', 'title' => 'Thiet bi blacklist', 'path' => '/maintenance/blacklist'],
            ['key' => 'return', 'title' => 'Phieu thu hoi', 'path' => '/retrieval/requests'],
            ['key' => 'assets', 'title' => 'Danh sach tai san', 'path' => '/admin/assets'],
        ];
    }

    private function countTable(string $table, array $conditions): int
    {
        if (!Schema::hasTable($table)) {
            return 0;
        }

        $query = DB::table($table);
        foreach ($conditions as $column => $value) {
            $query->where($column, $value);
        }

        return (int) $query->count();
    }

    private function returnWaitingCount(): int
    {
        if (!Schema::hasTable('assignments') || !Schema::hasColumn('assignments', 'return_requested_at')) {
            return 0;
        }

        return (int) DB::table('assignments')
            ->where('status', 'active')
            ->whereNotNull('return_requested_at')
            ->whereNull('returned_at')
            ->count();
    }

    private function isPrimaryDepartmentManager($user): bool
    {
        if (!$user?->department_id || !Schema::hasTable('departments')) {
            return false;
        }

        return (int) DB::table('departments')
            ->where('id', $user->department_id)
            ->where('manager_id', $user->id)
            ->count() > 0;
    }
}
