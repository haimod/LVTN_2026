<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class MaintenanceRecord extends Model
{
    protected $table = 'maintenance_records';

    protected $fillable = [
        'asset_id',
        'reported_by',
        'handled_by',
        'description',
        'image_path',
        'status',
        'repair_cost',
        'repaired_at',
    ];

    protected $casts = [
        'repair_cost' => 'decimal:2',
        'repaired_at' => 'datetime',
    ];

    public function asset()
    {
        return $this->belongsTo(Asset::class, 'asset_id');
    }

    public function reportedBy()
    {
        return $this->belongsTo(User::class, 'reported_by');
    }

    public function handledBy()
    {
        return $this->belongsTo(User::class, 'handled_by');
    }
}
