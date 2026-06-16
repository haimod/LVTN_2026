<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Assignment extends Model
{
    protected $table = 'assignments';

    protected $fillable = [
        'asset_id',
        'user_id',
        'assigned_by',
        'request_id',
        'is_emergency',
        'status',
        'note',
        'assigned_at',
        'confirmed_at',
        'returned_at',
        'returned_by',
        'return_requested_at',
        'return_reason',
        'return_admin_note',
        'cancelled_at',
        'cancelled_by',
        'cancel_reason',
    ];

    protected $casts = [
        'is_emergency' => 'boolean',
        'assigned_at' => 'datetime',
        'confirmed_at' => 'datetime',
        'returned_at' => 'datetime',
        'return_requested_at' => 'datetime',
        'cancelled_at' => 'datetime',
    ];

    public function asset()
    {
        return $this->belongsTo(Asset::class, 'asset_id');
    }

    public function user()
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    public function assignedBy()
    {
        return $this->belongsTo(User::class, 'assigned_by');
    }

    public function returnedBy()
    {
        return $this->belongsTo(User::class, 'returned_by');
    }

    public function cancelledBy()
    {
        return $this->belongsTo(User::class, 'cancelled_by');
    }

    public function request()
    {
        return $this->belongsTo(AssignmentRequest::class, 'request_id');
    }
}
