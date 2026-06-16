<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('maintenance_records')) {
            return;
        }

        Schema::create('maintenance_records', function (Blueprint $table) {
            $table->id();
            $table->foreignId('asset_id')->constrained('assets')->cascadeOnUpdate();
            $table->foreignId('reported_by')->constrained('users')->cascadeOnUpdate();
            $table->foreignId('handled_by')->nullable()->constrained('users')->nullOnDelete()->cascadeOnUpdate();
            $table->text('description');
            $table->string('image_path')->nullable();
            $table->enum('status', ['pending', 'repairing', 'done'])->default('pending');
            $table->decimal('repair_cost', 15, 2)->nullable();
            $table->timestamp('repaired_at')->nullable();
            $table->timestamps();

            $table->index('asset_id', 'idx_mr_asset');
            $table->index('status', 'idx_mr_status');
        });
    }

    public function down(): void
    {
        // No-op: this table may come from the imported SQL dump.
    }
};
