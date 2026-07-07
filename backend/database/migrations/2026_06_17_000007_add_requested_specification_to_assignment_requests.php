<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasTable('assignment_requests')) {
            return;
        }

        Schema::table('assignment_requests', function (Blueprint $table) {
            if (!Schema::hasColumn('assignment_requests', 'requested_specification')) {
                $table->text('requested_specification')->nullable()->after('category_id');
            }
        });
    }

    public function down(): void
    {
        if (!Schema::hasTable('assignment_requests')) {
            return;
        }

        Schema::table('assignment_requests', function (Blueprint $table) {
            if (Schema::hasColumn('assignment_requests', 'requested_specification')) {
                $table->dropColumn('requested_specification');
            }
        });
    }
};
