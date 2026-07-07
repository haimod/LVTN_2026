<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Asset;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class AssetHistoryController extends Controller
{
    public function activityLog(Request $request)
    {
        if (!$request->user()?->hasRole('admin')) {
            return response()->json([
                'status' => 'error',
                'message' => 'Ban khong co quyen xem nhat ky hoat dong.',
            ], 403);
        }

        if (!Schema::hasTable('asset_histories')) {
            return response()->json([
                'status' => 'success',
                'data' => [],
            ]);
        }

        $limit = min(max((int) $request->integer('limit', 100), 1), 200);

        $query = DB::table('asset_histories')
            ->leftJoin('assets', 'asset_histories.asset_id', '=', 'assets.id')
            ->leftJoin('users', 'asset_histories.user_id', '=', 'users.id');

        if ($request->filled('event_type')) {
            $query->where('asset_histories.event_type', $request->string('event_type')->toString());
        }

        if ($request->filled('status')) {
            $status = $request->string('status')->toString();
            $query->where(function ($statusQuery) use ($status) {
                $statusQuery
                    ->where('asset_histories.old_status', $status)
                    ->orWhere('asset_histories.new_status', $status);
            });
        }

        if ($request->filled('q')) {
            $keyword = '%' . $request->string('q')->toString() . '%';
            $query->where(function ($searchQuery) use ($keyword) {
                $searchQuery
                    ->where('assets.asset_code', 'like', $keyword)
                    ->orWhere('assets.name', 'like', $keyword)
                    ->orWhere('users.name', 'like', $keyword)
                    ->orWhere('users.email', 'like', $keyword)
                    ->orWhere('asset_histories.note', 'like', $keyword);
            });
        }

        if ($request->filled('date_from')) {
            $from = Carbon::parse($request->string('date_from')->toString(), 'Asia/Ho_Chi_Minh')
                ->startOfDay()
                ->timezone('UTC');
            $query->where('asset_histories.created_at', '>=', $from->format('Y-m-d H:i:s'));
        }

        if ($request->filled('date_to')) {
            $to = Carbon::parse($request->string('date_to')->toString(), 'Asia/Ho_Chi_Minh')
                ->endOfDay()
                ->timezone('UTC');
            $query->where('asset_histories.created_at', '<=', $to->format('Y-m-d H:i:s'));
        }

        $histories = $query
            ->orderByDesc('asset_histories.created_at')
            ->orderByDesc('asset_histories.id')
            ->limit($limit)
            ->select([
                'asset_histories.id',
                'asset_histories.asset_id',
                'asset_histories.user_id',
                'asset_histories.event_type',
                'asset_histories.old_status',
                'asset_histories.new_status',
                'asset_histories.note',
                'asset_histories.created_at',
                'assets.asset_code',
                'assets.name as asset_name',
                'users.name as user_name',
                'users.email as user_email',
            ])
            ->get()
            ->map(fn ($history) => [
                'id' => $history->id,
                'asset_id' => $history->asset_id,
                'user_id' => $history->user_id,
                'event_type' => $history->event_type,
                'old_status' => $history->old_status,
                'new_status' => $history->new_status,
                'note' => $history->note,
                'created_at' => $history->created_at,
                'asset_code' => $history->asset_code,
                'asset_name' => $history->asset_name,
                'user_name' => $history->user_name,
                'user_email' => $history->user_email,
            ])
            ->values();

        return response()->json([
            'status' => 'success',
            'data' => $histories,
        ]);
    }

    public function index(Request $request, int $assetId)
    {
        $user = $request->user();

        if (!$user || (!$user->hasRole('admin') && !$user->hasRole('manager'))) {
            return response()->json([
                'status' => 'error',
                'message' => 'Ban khong co quyen xem lich su tai san.',
            ], 403);
        }

        $asset = Asset::with(['category:id,name', 'department:id,name'])->find($assetId);
        if (!$asset) {
            return response()->json([
                'status' => 'error',
                'message' => 'Khong tim thay tai san.',
            ], 404);
        }

        if ($user->hasRole('manager') && (int) $asset->department_id !== (int) $user->department_id) {
            return response()->json([
                'status' => 'error',
                'message' => 'Ban chi duoc xem lich su tai san thuoc phong ban cua minh.',
            ], 403);
        }

        if (!Schema::hasTable('asset_histories')) {
            return response()->json([
                'status' => 'success',
                'data' => [
                    'asset' => $asset,
                    'histories' => [],
                ],
            ]);
        }

        $histories = DB::table('asset_histories')
            ->leftJoin('users', 'asset_histories.user_id', '=', 'users.id')
            ->where('asset_histories.asset_id', $asset->id)
            ->orderByDesc('asset_histories.created_at')
            ->orderByDesc('asset_histories.id')
            ->select([
                'asset_histories.id',
                'asset_histories.asset_id',
                'asset_histories.user_id',
                'asset_histories.event_type',
                'asset_histories.old_status',
                'asset_histories.new_status',
                'asset_histories.note',
                'asset_histories.created_at',
                'users.name as user_name',
                'users.email as user_email',
            ])
            ->get()
            ->map(function ($history) {
                return [
                    'id' => $history->id,
                    'asset_id' => $history->asset_id,
                    'event_type' => $history->event_type,
                    'old_status' => $history->old_status,
                    'new_status' => $history->new_status,
                    'note' => $history->note,
                    'created_at' => $history->created_at,
                    'user' => $history->user_id ? [
                        'id' => $history->user_id,
                        'name' => $history->user_name,
                        'email' => $history->user_email,
                    ] : null,
                ];
            });

        return response()->json([
            'status' => 'success',
            'data' => [
                'asset' => $asset,
                'histories' => $histories,
            ],
        ]);
    }
}
