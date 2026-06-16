<?php

namespace App\Models;
use App\Models\Asset;
use Illuminate\Database\Eloquent\Model;

class Category extends Model
{
    protected $table = 'categories';
    protected $fillable = ['parent_id', 'name', 'description'];

    // Một danh mục có nhiều tài sản
    public function assets()
    {
        return $this->hasMany(Asset::class, 'category_id');
    }
}
