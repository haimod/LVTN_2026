<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('assets') && DB::getDriverName() === 'mysql') {
            DB::statement("ALTER TABLE assets MODIFY status ENUM('new','in_use','waiting','repairing','disposed','under_investigation','permanently_lost') NOT NULL DEFAULT 'new'");
        }

        if (Schema::hasTable('lost_reports')) {
            return;
        }

        Schema::create('lost_reports', function (Blueprint $table) {
            $table->id();
            $table->foreignId('asset_id')->constrained('assets')->cascadeOnUpdate();
            $table->foreignId('assignment_id')->nullable()->constrained('assignments')->nullOnDelete()->cascadeOnUpdate();
            $table->foreignId('reported_by')->constrained('users')->cascadeOnUpdate();
            $table->foreignId('handled_by')->nullable()->constrained('users')->nullOnDelete()->cascadeOnUpdate();
            $table->text('description');
            $table->text('admin_note')->nullable();
            $table->enum('status', ['pending', 'recovered', 'permanently_lost'])->default('pending');
            $table->timestamp('resolved_at')->nullable();
            $table->timestamps();

            $table->index(['asset_id', 'status']);
            $table->index(['reported_by', 'status']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('lost_reports');
        // No-op for assets.status enum because old values may already contain lost workflow data.
    }
};
