<?php

namespace App\Models;

// use Illuminate\Contracts\Auth\MustVerifyEmail;
use Database\Factories\UserFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;
use Spatie\Permission\Traits\HasRoles;
#[Fillable(['name', 'email', 'password', 'is_active','phone','department_id'])]
#[Hidden(['password', 'remember_token'])]
class User extends Authenticatable
{
    /** @use HasFactory<UserFactory> */
    
    use HasFactory, Notifiable,HasApiTokens,HasRoles;
//
protected $guard_name = 'sanctum';
    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
        ];
    }

    // Bổ sung mối quan hệ với bảng departments
    public function department()
    {
        // Một User thuộc về một Department (khóa ngoại là department_id)
        return $this->belongsTo(Department::class, 'department_id');
    }
    // public function roles()
    // {
    //     // Liên kết nhiều-nhiều qua bảng model_has_roles
    //     return $this->belongsToMany(Role::class, 'model_has_roles', 'model_id', 'role_id')
    //                 ->wherePivot('model_type', User::class);
    // }
}
