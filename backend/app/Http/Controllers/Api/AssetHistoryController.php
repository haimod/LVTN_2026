<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Asset;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class AssetHistoryController extends Controller
{
    public function index(Request $request, int $assetId)
    {
        if (!$request->user()?->hasRole('admin')) {
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
