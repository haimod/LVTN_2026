<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('assignments')) {
            Schema::table('assignments', function (Blueprint $table) {
                if (!Schema::hasColumn('assignments', 'is_emergency')) {
                    $table->boolean('is_emergency')->default(false)->after('request_id');
                }

                if (!Schema::hasColumn('assignments', 'cancelled_at')) {
                    $table->timestamp('cancelled_at')->nullable()->after('returned_by');
                }

                if (!Schema::hasColumn('assignments', 'cancelled_by')) {
                    $table->unsignedBigInteger('cancelled_by')->nullable()->after('cancelled_at');
                }

                if (!Schema::hasColumn('assignments', 'cancel_reason')) {
                    $table->text('cancel_reason')->nullable()->after('cancelled_by');
                }
            });
        }

        if (Schema::hasTable('assignment_requests') && DB::getDriverName() === 'mysql') {
            DB::statement("ALTER TABLE assignment_requests MODIFY status ENUM('pending','mgr_approved','approved','rejected','cancelled','out_of_stock') NOT NULL DEFAULT 'pending'");
        }
    }

    public function down(): void
    {
        // No-op: reversing enum/field changes could lose workflow data.
    }
};
