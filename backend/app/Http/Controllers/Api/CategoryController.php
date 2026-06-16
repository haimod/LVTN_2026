<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Category;
use Illuminate\Http\Request;

class CategoryController extends Controller
{
    public function index()
    {
        $categories = Category::withCount('assets')
            ->orderBy('name', 'asc')
            ->get();

        return response()->json([
            'status' => 'success',
            'data' => $categories
        ], 200);
    }

    public function store(Request $request)
    {
        if (!$this->isAdmin($request)) {
            return $this->forbidden();
        }

        $request->validate([
            'name' => 'required|string|max:191|unique:categories,name',
            'description' => 'nullable|string',
        ]);

        $category = Category::create([
            'name' => $request->name,
            'parent_id' => null,
            'description' => $request->description,
        ]);
        $category->loadCount('assets');

        return response()->json([
            'status' => 'success',
            'message' => 'Thêm danh mục thành công!',
            'data' => $category
        ], 201);
    }

    public function show($id)
    {
        $category = Category::withCount('assets')->find($id);

        if (!$category) {
            return response()->json(['status' => 'error', 'message' => 'Không tìm thấy danh mục'], 404);
        }

        return response()->json([
            'status' => 'success',
            'data' => $category
        ], 200);
    }

    public function update(Request $request, $id)
    {
        if (!$this->isAdmin($request)) {
            return $this->forbidden();
        }

        $category = Category::find($id);
        if (!$category) {
            return response()->json(['status' => 'error', 'message' => 'Không tìm thấy danh mục'], 404);
        }

        $request->validate([
            'name' => 'required|string|max:191|unique:categories,name,' . $id,
            'description' => 'nullable|string',
        ]);

        $category->update([
            'name' => $request->name,
            'parent_id' => null,
            'description' => $request->description,
        ]);
        $category->loadCount('assets');

        return response()->json([
            'status' => 'success',
            'message' => 'Cập nhật danh mục thành công!',
            'data' => $category
        ], 200);
    }

    public function destroy(Request $request, $id)
    {
        if (!$this->isAdmin($request)) {
            return $this->forbidden();
        }

        $category = Category::withCount('assets')->find($id);
        if (!$category) {
            return response()->json(['status' => 'error', 'message' => 'Không tìm thấy danh mục'], 404);
        }

        if ($category->assets_count > 0) {
            return response()->json([
                'status' => 'error',
                'message' => "Không thể xóa! Đang có {$category->assets_count} tài sản thuộc danh mục này."
            ], 400);
        }

        $category->delete();

        return response()->json([
            'status' => 'success',
            'message' => 'Đã xóa danh mục thành công!'
        ], 200);
    }

    private function isAdmin(Request $request): bool
    {
        return $request->user()?->hasRole('admin') === true;
    }

    private function forbidden()
    {
        return response()->json([
            'status' => 'error',
            'message' => 'Bạn không có quyền thao tác danh mục thiết bị.'
        ], 403);
    }
}
