<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('totals', function (Blueprint $table) {
            $table->integer('console')->default(0)->after('rule');
            $table->index(['user', 'rule', 'console'], 'totals_user_rule_console_index');
            $table->index(['rule', 'console', 'rps'], 'totals_rule_console_rps_index');
        });
    }

    public function down(): void
    {
        Schema::table('totals', function (Blueprint $table) {
            $table->dropIndex('totals_user_rule_console_index');
            $table->dropIndex('totals_rule_console_rps_index');
            $table->dropColumn('console');
        });
    }
};
