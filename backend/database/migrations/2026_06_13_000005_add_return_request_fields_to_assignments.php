<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasTable('assignments')) {
            return;
        }

        Schema::table('assignments', function (Blueprint $table) {
            if (!Schema::hasColumn('assignments', 'return_requested_at')) {
                $table->timestamp('return_requested_at')->nullable()->after('returned_by');
            }

            if (!Schema::hasColumn('assignments', 'return_reason')) {
                $table->text('return_reason')->nullable()->after('return_requested_at');
            }

            if (!Schema::hasColumn('assignments', 'return_admin_note')) {
                $table->text('return_admin_note')->nullable()->after('return_reason');
            }
        });
    }

    public function down(): void
    {
        if (!Schema::hasTable('assignments')) {
            return;
        }

        Schema::table('assignments', function (Blueprint $table) {
            if (Schema::hasColumn('assignments', 'return_admin_note')) {
                $table->dropColumn('return_admin_note');
            }

            if (Schema::hasColumn('assignments', 'return_reason')) {
                $table->dropColumn('return_reason');
            }

            if (Schema::hasColumn('assignments', 'return_requested_at')) {
                $table->dropColumn('return_requested_at');
            }
        });
    }
};
