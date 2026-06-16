<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasTable('assets') || !Schema::hasColumn('assets', 'department_id')) {
            return;
        }

        $this->dropForeignIfExists('fk_assets_department');

        DB::statement('ALTER TABLE assets MODIFY department_id BIGINT UNSIGNED NULL');
        DB::statement('ALTER TABLE assets ADD CONSTRAINT fk_assets_department FOREIGN KEY (department_id) REFERENCES departments(id) ON UPDATE CASCADE');
    }

    public function down(): void
    {
        if (!Schema::hasTable('assets') || !Schema::hasColumn('assets', 'department_id')) {
            return;
        }

        $fallbackDepartmentId = DB::table('departments')->orderBy('id')->value('id');
        if (!$fallbackDepartmentId) {
            return;
        }

        $this->dropForeignIfExists('fk_assets_department');

        DB::table('assets')->whereNull('department_id')->update(['department_id' => $fallbackDepartmentId]);
        DB::statement('ALTER TABLE assets MODIFY department_id BIGINT UNSIGNED NOT NULL');
        DB::statement('ALTER TABLE assets ADD CONSTRAINT fk_assets_department FOREIGN KEY (department_id) REFERENCES departments(id) ON UPDATE CASCADE');
    }

    private function dropForeignIfExists(string $constraint): void
    {
        $exists = DB::table('information_schema.TABLE_CONSTRAINTS')
            ->whereRaw('TABLE_SCHEMA = DATABASE()')
            ->where('TABLE_NAME', 'assets')
            ->where('CONSTRAINT_NAME', $constraint)
            ->exists();

        if ($exists) {
            DB::statement("ALTER TABLE assets DROP FOREIGN KEY {$constraint}");
        }
    }
};
