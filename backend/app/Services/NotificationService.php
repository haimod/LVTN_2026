<?php

namespace App\Services;

use App\Models\Department;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class NotificationService
{
    public function notifyUser(?User $user, string $title, string $message, string $level = 'info', array $payload = []): void
    {
        if (!$user) {
            return;
        }

        DB::table('notifications')->insert([
            'id' => (string) Str::uuid(),
            'type' => 'asset.notification',
            'notifiable_type' => User::class,
            'notifiable_id' => $user->id,
            'data' => json_encode(array_merge($payload, [
                'title' => $title,
                'message' => $message,
                'level' => $level,
            ]), JSON_UNESCAPED_UNICODE),
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    public function notifyUsers(iterable $users, string $title, string $message, string $level = 'info', array $payload = []): void
    {
        foreach ($users as $user) {
            $this->notifyUser($user, $title, $message, $level, $payload);
        }
    }

    public function notifyAdmins(string $title, string $message, string $level = 'info', array $payload = []): void
    {
        $admins = User::role('admin')->get();
        $this->notifyUsers($admins, $title, $message, $level, $payload);
    }

    public function notifyDepartmentManager(?int $departmentId, string $title, string $message, string $level = 'info', array $payload = []): void
    {
        if (!$departmentId) {
            return;
        }

        $department = Department::with('manager')->find($departmentId);
        $this->notifyUser($department?->manager, $title, $message, $level, $payload);
    }
}
