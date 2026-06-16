<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class ReportController extends Controller
{
    public function overview(Request $request)
    {
        if (!$request->user()?->hasRole('admin')) {
            return response()->json([
                'status' => 'error',
                'message' => 'Ban khong co quyen xem bao cao.',
            ], 403);
        }

        $assetSummary = $this->assetSummary();

        return response()->json([
            'status' => 'success',
            'data' => [
                'asset_summary' => $assetSummary,
                'assets_by_status' => $this->assetsByStatus(),
                'assets_by_category' => $this->assetsByCategory(),
                'assets_by_department' => $this->assetsByDepartment(),
                'borrow_summary' => $this->borrowSummary(),
                'issue_summary' => $this->issueSummary(),
            ],
        ]);
    }

    public function exportOverview(Request $request)
    {
        if (!$request->user()?->hasRole('admin')) {
            return response()->json([
                'status' => 'error',
                'message' => 'Ban khong co quyen xuat bao cao.',
            ], 403);
        }

        $assetSummary = $this->assetSummary();
        $assetsByStatus = $this->assetsByStatus();
        $assetsByCategory = $this->assetsByCategory();
        $assetsByDepartment = $this->assetsByDepartment();
        $borrowSummary = $this->borrowSummary();
        $issueSummary = $this->issueSummary();
        $filename = 'bao-cao-kiem-ke-' . now()->format('Ymd-His') . '.csv';

        return response()->streamDownload(function () use (
            $assetSummary,
            $assetsByStatus,
            $assetsByCategory,
            $assetsByDepartment,
            $borrowSummary,
            $issueSummary
        ) {
            $handle = fopen('php://output', 'w');
            fwrite($handle, "\xEF\xBB\xBF");

            fputcsv($handle, ['Bao cao kiem ke tai san']);
            fputcsv($handle, ['Thoi gian xuat', now()->format('d/m/Y H:i:s')]);
            fputcsv($handle, []);

            fputcsv($handle, ['Tong quan']);
            fputcsv($handle, ['Chi so', 'Gia tri']);
            fputcsv($handle, ['Tong tai san', $assetSummary['total']]);
            fputcsv($handle, ['San sang trong kho', $assetSummary['warehouse']]);
            fputcsv($handle, ['Gia tri dang quan ly', $assetSummary['active_value']]);
            fputcsv($handle, ['Gia tri da thanh ly', $assetSummary['disposed_value']]);
            fputcsv($handle, []);

            fputcsv($handle, ['Tai san theo trang thai']);
            fputcsv($handle, ['Trang thai', 'So luong']);
            foreach ($assetsByStatus as $row) {
                fputcsv($handle, [$row['status'], $row['total']]);
            }
            fputcsv($handle, []);

            fputcsv($handle, ['Tai san theo danh muc']);
            fputcsv($handle, ['Danh muc', 'So luong']);
            foreach ($assetsByCategory as $row) {
                fputcsv($handle, [$row['category_name'], $row['total']]);
            }
            fputcsv($handle, []);

            fputcsv($handle, ['Tai san theo phong ban']);
            fputcsv($handle, ['Phong ban', 'So luong']);
            foreach ($assetsByDepartment as $row) {
                fputcsv($handle, [$row['department_name'], $row['total']]);
            }
            fputcsv($handle, []);

            fputcsv($handle, ['Luong muon tra']);
            fputcsv($handle, ['Chi so', 'So luong']);
            foreach ($borrowSummary as $key => $value) {
                fputcsv($handle, [$key, $value]);
            }
            fputcsv($handle, []);

            fputcsv($handle, ['Su co va mat thiet bi']);
            fputcsv($handle, ['Chi so', 'So luong']);
            foreach ($issueSummary as $key => $value) {
                fputcsv($handle, [$key, $value]);
            }

            fclose($handle);
        }, $filename, [
            'Content-Type' => 'text/csv; charset=UTF-8',
        ]);
    }

    private function assetSummary(): array
    {
        if (!Schema::hasTable('assets')) {
            return [
                'total' => 0,
                'warehouse' => 0,
                'active_value' => 0,
                'disposed_value' => 0,
            ];
        }

        return [
            'total' => (int) DB::table('assets')->count(),
            'warehouse' => (int) DB::table('assets')->whereNull('department_id')->where('status', 'new')->count(),
            'active_value' => (float) DB::table('assets')->where('status', '!=', 'disposed')->sum('purchase_price'),
            'disposed_value' => (float) DB::table('assets')->where('status', 'disposed')->sum('purchase_price'),
        ];
    }

    private function assetsByStatus(): array
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

    private function assetsByCategory(): array
    {
        if (!Schema::hasTable('assets')) {
            return [];
        }

        return DB::table('assets')
            ->leftJoin('categories', 'assets.category_id', '=', 'categories.id')
            ->select('categories.name as category_name', DB::raw('COUNT(assets.id) as total'))
            ->groupBy('categories.name')
            ->orderByDesc('total')
            ->get()
            ->map(fn ($item) => [
                'category_name' => $item->category_name ?: 'Chua phan loai',
                'total' => (int) $item->total,
            ])
            ->values()
            ->all();
    }

    private function assetsByDepartment(): array
    {
        if (!Schema::hasTable('assets')) {
            return [];
        }

        return DB::table('assets')
            ->leftJoin('departments', 'assets.department_id', '=', 'departments.id')
            ->select('departments.name as department_name', DB::raw('COUNT(assets.id) as total'))
            ->groupBy('departments.name')
            ->orderByDesc('total')
            ->get()
            ->map(fn ($item) => [
                'department_name' => $item->department_name ?: 'Kho tong',
                'total' => (int) $item->total,
            ])
            ->values()
            ->all();
    }

    private function borrowSummary(): array
    {
        $summary = [
            'requests_pending_manager' => 0,
            'requests_waiting_admin' => 0,
            'requests_out_of_stock' => 0,
            'assignments_waiting_confirm' => 0,
            'assignments_active' => 0,
            'return_waiting_admin' => 0,
            'assignments_returned' => 0,
        ];

        if (Schema::hasTable('assignment_requests')) {
            $summary['requests_pending_manager'] = (int) DB::table('assignment_requests')->where('status', 'pending')->count();
            $summary['requests_waiting_admin'] = (int) DB::table('assignment_requests')->where('status', 'mgr_approved')->count();
            $summary['requests_out_of_stock'] = (int) DB::table('assignment_requests')->where('status', 'out_of_stock')->count();
        }

        if (Schema::hasTable('assignments')) {
            $summary['assignments_waiting_confirm'] = (int) DB::table('assignments')->where('status', 'waiting')->count();
            $summary['assignments_active'] = (int) DB::table('assignments')->where('status', 'active')->count();
            $summary['assignments_returned'] = (int) DB::table('assignments')->where('status', 'returned')->count();

            if (Schema::hasColumn('assignments', 'return_requested_at')) {
                $summary['return_waiting_admin'] = (int) DB::table('assignments')
                    ->where('status', 'active')
                    ->whereNotNull('return_requested_at')
                    ->whereNull('returned_at')
                    ->count();
            }
        }

        return $summary;
    }

    private function issueSummary(): array
    {
        $summary = [
            'maintenance_pending' => 0,
            'maintenance_repairing' => 0,
            'lost_pending' => 0,
            'lost_permanent' => 0,
        ];

        if (Schema::hasTable('maintenance_records')) {
            $summary['maintenance_pending'] = (int) DB::table('maintenance_records')->where('status', 'pending')->count();
            $summary['maintenance_repairing'] = (int) DB::table('maintenance_records')->where('status', 'repairing')->count();
        }

        if (Schema::hasTable('lost_reports')) {
            $summary['lost_pending'] = (int) DB::table('lost_reports')->where('status', 'pending')->count();
            $summary['lost_permanent'] = (int) DB::table('lost_reports')->where('status', 'permanently_lost')->count();
        }

        return $summary;
    }
}
