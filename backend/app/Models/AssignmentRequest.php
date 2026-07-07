<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class AssignmentRequest extends Model
{
    protected $table = 'assignment_requests';

    protected $fillable = [
        'requester_id',
        'category_id',
        'requested_specification',
        'reason',
        'expected_return_date',
        'status',
        'manager_id',
        'manager_note',
        'manager_at',
        'admin_id',
        'admin_note',
        'admin_at',
    ];

    protected $casts = [
        'expected_return_date' => 'date:Y-m-d',
        'manager_at' => 'datetime',
        'admin_at' => 'datetime',
    ];

    public function requester()
    {
        return $this->belongsTo(User::class, 'requester_id');
    }

    public function category()
    {
        return $this->belongsTo(Category::class, 'category_id');
    }

    public function manager()
    {
        return $this->belongsTo(User::class, 'manager_id');
    }

    public function admin()
    {
        return $this->belongsTo(User::class, 'admin_id');
    }
}
