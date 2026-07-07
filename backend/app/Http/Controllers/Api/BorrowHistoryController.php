<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Assignment;
use Illuminate\Http\Request;

class BorrowHistoryController extends Controller
{
    public function index(Request $request)
    {
        $user = $request->user();

        $query = Assignment::with([
            'asset:id,uuid,asset_code,name,category_id,image_path,status',
            'asset.category:id,name',
            'assignedBy:id,name',
            'returnedBy:id,name',
            'lostReport:id,asset_id,assignment_id,reported_by,handled_by,description,admin_note,status,resolved_at,created_at',
            'lostReport.reportedBy:id,name',
            'lostReport.handledBy:id,name',
        ])->where('user_id', $user->id);

        if ($request->filled('status') && in_array($request->status, ['waiting', 'active', 'returned'], true)) {
            $query->where('status', $request->status);
        }

        if ($request->filled('search')) {
            $search = $request->search;
            $query->whereHas('asset', function ($assetQuery) use ($search) {
                $assetQuery->where('asset_code', 'like', "%{$search}%")
                    ->orWhere('name', 'like', "%{$search}%")
                    ->orWhereHas('category', function ($categoryQuery) use ($search) {
                        $categoryQuery->where('name', 'like', "%{$search}%");
                    });
            });
        }

        $assignments = $query->orderByDesc('assigned_at')
            ->orderByDesc('id')
            ->get();

        return response()->json([
            'status' => 'success',
            'data' => $assignments
        ], 200);
    }
}
