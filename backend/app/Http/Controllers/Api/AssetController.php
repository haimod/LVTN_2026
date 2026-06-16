<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Asset;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;
use Carbon\Carbon;

class AssetController extends Controller
{
    // 1. LẤY DANH SÁCH TÀI SẢN (Kèm theo search và filter)
    public function index(Request $request)
    {
        $query = Asset::with(['category:id,name', 'department:id,name']);
        $user = $request->user();
        $role = $user?->roles()->value('name');

        if ($role === 'manager') {
            $user->department_id
                ? $query->where('department_id', $user->department_id)
                : $query->whereRaw('1 = 0');
        } elseif ($role !== 'admin') {
            // Chưa có bảng phiếu bàn giao/người đang giữ nên không thể xác định tài sản cá nhân.
            $query->whereRaw('1 = 0');
        }

        if ($request->filled('search')) {
            $search = $request->search;
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                  ->orWhere('asset_code', 'like', "%{$search}%");
            });
        }

        if ($request->filled('category_id')) {
            $query->where('category_id', $request->category_id);
        }

        if ($request->filled('department_id')) {
            $request->department_id === 'warehouse'
                ? $query->whereNull('department_id')
                : $query->where('department_id', $request->department_id);
        }

        if ($request->filled('status')) {
            $query->where('status', $request->status);
        }

        $assets = $query->orderBy('created_at', 'desc')->get();

        return response()->json([
            'status' => 'success',
            'data' => $assets
        ], 200);
    }

    // 2. THÊM TÀI SẢN MỚI
    public function export(Request $request)
    {
        if (!$this->isAdmin($request)) {
            return $this->forbidden();
        }

        $query = Asset::with(['category:id,name', 'department:id,name']);

        if ($request->filled('search')) {
            $search = $request->search;
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                  ->orWhere('asset_code', 'like', "%{$search}%");
            });
        }

        if ($request->filled('category_id')) {
            $query->where('category_id', $request->category_id);
        }

        if ($request->filled('department_id')) {
            $request->department_id === 'warehouse'
                ? $query->whereNull('department_id')
                : $query->where('department_id', $request->department_id);
        }

        if ($request->filled('status')) {
            $query->where('status', $request->status);
        }

        $assets = $query->orderBy('created_at', 'desc')->get();
        $filename = 'danh-sach-tai-san-' . now()->format('Ymd-His') . '.csv';

        return response()->streamDownload(function () use ($assets) {
            $handle = fopen('php://output', 'w');
            fwrite($handle, "\xEF\xBB\xBF");

            fputcsv($handle, [
                'Ma tai san',
                'Ten tai san',
                'Danh muc',
                'Vi tri',
                'Trang thai',
                'Gia mua',
                'Ngay mua',
                'Han bao hanh',
                'Mo ta',
            ]);

            foreach ($assets as $asset) {
                fputcsv($handle, [
                    $asset->asset_code,
                    $asset->name,
                    $asset->category?->name,
                    $asset->department?->name ?: 'Kho tong',
                    $asset->status,
                    $asset->purchase_price,
                    $asset->purchase_date,
                    $asset->warranty_expiry,
                    $asset->description,
                ]);
            }

            fclose($handle);
        }, $filename, [
            'Content-Type' => 'text/csv; charset=UTF-8',
        ]);
    }

    public function store(Request $request)
    {
        if (!$this->isAdmin($request)) {
            return $this->forbidden();
        }

        $request->validate([
            'name' => 'required|string|max:191',
            'category_id' => 'required|exists:categories,id',
            'department_id' => 'nullable|exists:departments,id',
            'purchase_price' => 'required|numeric|min:0',
            'purchase_date' => 'required|date',
            'warranty_expiry' => 'nullable|date|after_or_equal:purchase_date',
            'image' => 'nullable|image|mimes:jpg,jpeg,png,webp|max:4096',
        ]);

        $asset = DB::transaction(function () use ($request) {
            // Tự động sinh mã tài sản: TS-YYYY-NNNNN
            $year = Carbon::parse($request->purchase_date)->format('Y');
            
            // Tìm tài sản cuối cùng trong năm đó để lấy số thứ tự
            $latestAsset = Asset::where('asset_code', 'like', "TS-{$year}-%")
                                ->orderBy('asset_code', 'desc')
                                ->lockForUpdate() // Khóa dòng để tránh trùng lặp khi request đồng thời
                                ->first();

            if ($latestAsset) {
                $lastNumber = intval(substr($latestAsset->asset_code, -5));
                $nextNumber = $lastNumber + 1;
            } else {
                $nextNumber = 1;
            }

            $assetCode = "TS-{$year}-" . str_pad($nextNumber, 5, '0', STR_PAD_LEFT);

            // Tạm thời để đường dẫn QR rỗng, có thể nâng cấp thư viện tạo ảnh QR sau
            $qrCodePath = 'qr/' . $assetCode . '.png';
            $imagePath = $this->storeImage($request, $assetCode);

            return Asset::create([
                'asset_code' => $assetCode,
                'name' => $request->name,
                'category_id' => $request->category_id,
                'department_id' => null,
                'description' => $request->description,
                'purchase_price' => $request->purchase_price,
                'purchase_date' => $request->purchase_date,
                'warranty_expiry' => $request->warranty_expiry,
                'image_path' => $imagePath,
                'qr_code_path' => $qrCodePath,
                'status' => 'new',
            ]);
        });

        $asset->load(['category', 'department']);

        return response()->json([
            'status' => 'success',
            'message' => 'Thêm tài sản thành công!',
            'data' => $asset
        ], 201);
    }

    // 3. XEM CHI TIẾT
    public function show($id)
    {
        $asset = Asset::with(['category', 'department'])->find($id);
        if (!$asset) return response()->json(['status' => 'error', 'message' => 'Không tìm thấy tài sản'], 404);

        $request = request();
        if (!$this->canView($request, $asset)) {
            return $this->forbidden();
        }

        return response()->json(['status' => 'success', 'data' => $asset], 200);
    }

    // 4. CẬP NHẬT
    public function update(Request $request, $id)
    {
        if (!$this->isAdmin($request)) {
            return $this->forbidden();
        }

        $asset = Asset::find($id);
        if (!$asset) return response()->json(['status' => 'error', 'message' => 'Không tìm thấy tài sản'], 404);

        if ($asset->status !== 'new') {
            return response()->json([
                'status' => 'error',
                'message' => 'Chi co the chinh sua tai san moi nhap kho. Tai san da cap phat, bao tri, bao mat hoac thanh ly khong duoc sua.'
            ], 400);
        }

        $request->validate([
            'name' => 'required|string|max:191',
            'category_id' => 'required|exists:categories,id',
            'purchase_price' => 'required|numeric|min:0',
            'purchase_date' => 'required|date',
            'warranty_expiry' => 'nullable|date|after_or_equal:purchase_date',
            'image' => 'nullable|image|mimes:jpg,jpeg,png,webp|max:4096',
        ]);

        $data = $request->only([
            'name', 'category_id', 'description',
            'purchase_price', 'purchase_date', 'warranty_expiry'
        ]);

        if ($request->hasFile('image')) {
            $this->deleteImage($asset->image_path);
            $data['image_path'] = $this->storeImage($request, $asset->asset_code);
        }

        $asset->update($data);

        $asset->load(['category', 'department']);

        return response()->json([
            'status' => 'success',
            'message' => 'Cập nhật tài sản thành công!',
            'data' => $asset
        ], 200);
    }

    public function dispose(Request $request, $id)
    {
        if (!$this->isAdmin($request)) {
            return $this->forbidden();
        }

        $request->validate([
            'reason' => 'required|string|min:5|max:2000',
        ], [
            'reason.required' => 'Vui long nhap ly do thanh ly.',
            'reason.min' => 'Ly do thanh ly can toi thieu 5 ky tu.',
        ]);

        $asset = DB::transaction(function () use ($request, $id) {
            $asset = Asset::where('id', $id)->lockForUpdate()->first();

            if (!$asset) {
                return null;
            }

            if ($asset->status !== 'new' || $asset->department_id !== null) {
                return false;
            }

            $oldStatus = $asset->status;

            $asset->update([
                'status' => 'disposed',
                'department_id' => null,
            ]);

            if (Schema::hasTable('asset_histories')) {
                DB::table('asset_histories')->insert([
                    'asset_id' => $asset->id,
                    'user_id' => $request->user()->id,
                    'event_type' => 'disposed',
                    'old_status' => $oldStatus,
                    'new_status' => 'disposed',
                    'note' => $request->reason,
                    'created_at' => now(),
                ]);
            }

            return $asset;
        });

        if ($asset === null) {
            return response()->json(['status' => 'error', 'message' => 'Khong tim thay tai san'], 404);
        }

        if ($asset === false) {
            return response()->json([
                'status' => 'error',
                'message' => 'Chi co the thanh ly tai san dang o kho tong va trang thai moi nhap kho.'
            ], 400);
        }

        $asset->load(['category', 'department']);

        return response()->json([
            'status' => 'success',
            'message' => 'Da thanh ly tai san.',
            'data' => $asset,
        ]);
    }

    // 5. XÓA TÀI SẢN
    public function destroy($id)
    {
        if (!$this->isAdmin(request())) {
            return $this->forbidden();
        }

        $asset = Asset::find($id);
        if (!$asset) return response()->json(['status' => 'error', 'message' => 'Không tìm thấy tài sản'], 404);

        // Chặn xóa nếu tài sản không ở trạng thái 'new' hoặc 'disposed'
        if (!in_array($asset->status, ['new', 'disposed'])) {
            return response()->json([
                'status' => 'error',
                'message' => 'Chỉ có thể xóa tài sản mới nhập kho hoặc đã thanh lý!'
            ], 400);
        }

        $asset->delete();

        return response()->json(['status' => 'success', 'message' => 'Xóa tài sản thành công!'], 200);
    }

    private function isAdmin(Request $request): bool
    {
        return $request->user()?->hasRole('admin') === true;
    }

    private function forbidden()
    {
        return response()->json([
            'status' => 'error',
            'message' => 'Bạn không có quyền thao tác kho tài sản tổng.'
        ], 403);
    }

    private function canView(Request $request, Asset $asset): bool
    {
        $user = $request->user();
        $role = $user?->roles()->value('name');

        if ($role === 'admin') {
            return true;
        }

        if ($role === 'manager') {
            return $user->department_id && (string) $asset->department_id === (string) $user->department_id;
        }

        return false;
    }

    private function storeImage(Request $request, string $assetCode): ?string
    {
        if (!$request->hasFile('image')) {
            return null;
        }

        $directory = public_path('uploads/assets');
        File::ensureDirectoryExists($directory);

        $file = $request->file('image');
        $extension = strtolower($file->getClientOriginalExtension());
        $filename = $assetCode . '-' . Str::random(8) . '.' . $extension;

        $file->move($directory, $filename);

        return 'uploads/assets/' . $filename;
    }

    private function deleteImage(?string $path): void
    {
        if (!$path || !Str::startsWith($path, 'uploads/assets/')) {
            return;
        }

        File::delete(public_path($path));
    }
}
