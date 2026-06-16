<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Asset;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class LiquidationController extends Controller
{
    public function index(Request $request)
    {
        if (!$request->user()?->hasRole('admin')) {
            return response()->json([
                'status' => 'error',
                'message' => 'Ban khong co quyen xem phieu thanh ly.',
            ], 403);
        }

        $query = Asset::with(['category:id,name', 'department:id,name'])
            ->where('status', 'disposed');

        if ($request->filled('search')) {
            $search = $request->search;
            $query->where(function ($q) use ($search) {
                $q->where('asset_code', 'like', "%{$search}%")
                    ->orWhere('name', 'like', "%{$search}%")
                    ->orWhereHas('category', function ($categoryQuery) use ($search) {
                        $categoryQuery->where('name', 'like', "%{$search}%");
                    });
            });
        }

        $assets = $query->orderByDesc('updated_at')
            ->orderByDesc('id')
            ->get();

        $historiesByAsset = collect();
        if ($assets->isNotEmpty() && Schema::hasTable('asset_histories')) {
            $historiesByAsset = DB::table('asset_histories')
                ->leftJoin('users', 'asset_histories.user_id', '=', 'users.id')
                ->whereIn('asset_histories.asset_id', $assets->pluck('id'))
                ->where('asset_histories.event_type', 'disposed')
                ->orderByDesc('asset_histories.created_at')
                ->orderByDesc('asset_histories.id')
                ->select([
                    'asset_histories.id',
                    'asset_histories.asset_id',
                    'asset_histories.note',
                    'asset_histories.created_at',
                    'users.id as user_id',
                    'users.name as user_name',
                    'users.email as user_email',
                ])
                ->get()
                ->groupBy('asset_id')
                ->map(fn ($items) => $items->first());
        }

        $data = $assets->map(function ($asset) use ($historiesByAsset) {
            $history = $historiesByAsset->get($asset->id);

            return [
                'id' => $asset->id,
                'asset' => $asset,
                'reason' => $history?->note,
                'disposed_at' => $history?->created_at ?? $asset->updated_at,
                'handled_by' => $history?->user_id ? [
                    'id' => $history->user_id,
                    'name' => $history->user_name,
                    'email' => $history->user_email,
                ] : null,
            ];
        });

        return response()->json([
            'status' => 'success',
            'data' => $data,
        ]);
    }
}
