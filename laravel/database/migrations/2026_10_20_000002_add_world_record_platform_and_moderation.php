<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('world_record_reports', function (Blueprint $table) {
            $table->unsignedTinyInteger('platform')->nullable();
            $table->timestamp('deleted_at')->nullable();
            $table->string('deleted_by', 191)->nullable();
            $table->index(['reporter_user_id', 'deleted_at']);
        });
        // Only fixed-platform legacy reports can be classified without guessing.
        DB::table('world_record_reports')->where('rule', 48)->orWhereBetween('stage_id', [331, 344])->update(['platform' => 4]);
        Schema::create('world_record_reporter_locks', function (Blueprint $table) {
            $table->string('user_id', 191)->primary();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('world_record_reporter_locks');
        Schema::table('world_record_reports', function (Blueprint $table) {
            $table->dropIndex(['reporter_user_id', 'deleted_at']);
            $table->dropColumn(['platform', 'deleted_at', 'deleted_by']);
        });
    }
};
