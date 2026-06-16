<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Str;

class Asset extends Model
{
    protected $table = 'assets';

    protected $fillable = [
        'uuid', 'asset_code', 'category_id', 'department_id', 
        'name', 'description', 'purchase_price', 'purchase_date', 
        'warranty_expiry', 'image_path', 'qr_code_path', 'status'
    ];

    // Tự động sinh UUID khi tạo mới tài sản
    protected static function boot()
    {
        parent::boot();
        static::creating(function ($asset) {
            if (empty($asset->uuid)) {
                $asset->uuid = (string) Str::uuid();
            }
        });
    }

    public function category()
    {
        return $this->belongsTo(Category::class, 'category_id');
    }

    public function department()
    {
        return $this->belongsTo(Department::class, 'department_id');
    }
}