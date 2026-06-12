<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Department extends Model
{
    // Chỉ định chính xác tên bảng trong CSDL
    protected $table = 'departments';

    // (Tùy chọn) Cho phép thêm/sửa các cột này
    protected $fillable = ['name', 'code', 'description', 'manager_id']; 
    public function manager()
    {
        return $this->belongsTo(User::class, 'manager_id');
    }
    // Một phòng ban có NHIỀU nhân viên
    public function users()
    {
        return $this->hasMany(User::class, 'department_id');
    }
}