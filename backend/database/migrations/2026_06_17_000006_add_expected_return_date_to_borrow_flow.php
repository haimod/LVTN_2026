<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('assignment_requests')) {
            Schema::table('assignment_requests', function (Blueprint $table) {
                if (!Schema::hasColumn('assignment_requests', 'expected_return_date')) {
                    $table->date('expected_return_date')->nullable()->after('reason');
                }
            });
        }

        if (Schema::hasTable('assignments')) {
            Schema::table('assignments', function (Blueprint $table) {
                if (!Schema::hasColumn('assignments', 'expected_return_date')) {
                    $table->date('expected_return_date')->nullable()->after('assigned_at');
                }
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasTable('assignments')) {
            Schema::table('assignments', function (Blueprint $table) {
                if (Schema::hasColumn('assignments', 'expected_return_date')) {
                    $table->dropColumn('expected_return_date');
                }
            });
        }

        if (Schema::hasTable('assignment_requests')) {
            Schema::table('assignment_requests', function (Blueprint $table) {
                if (Schema::hasColumn('assignment_requests', 'expected_return_date')) {
                    $table->dropColumn('expected_return_date');
                }
            });
        }
    }
};
