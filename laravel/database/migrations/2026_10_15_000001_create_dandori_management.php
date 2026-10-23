<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('stages', function (Blueprint $table) {
            $table->string('stage_code', 16)->nullable()->unique();
        });
        Schema::create('dandori_locks', function (Blueprint $table) {
            $table->unsignedInteger('id')->primary();
        });
        DB::table('dandori_locks')->insert(['id' => 1]);
        Schema::create('dandori_stages', function (Blueprint $table) {
            $table->unsignedBigInteger('stage_id')->primary();
            $table->string('score_type', 16);
            $table->string('score_order', 4);
            $table->unsignedInteger('total_base')->default(600);
            $table->json('consoles');
            $table->boolean('require_video')->default(false);
            $table->boolean('require_image')->default(false);
            $table->timestamps();
        });
        Schema::create('dandori_releases', function (Blueprint $table) {
            $table->id();
            $table->string('month', 7)->unique();
            $table->unsignedInteger('revision')->default(1);
            $table->timestamp('publish_at')->nullable();
            $table->timestamps();
        });
        Schema::create('dandori_slots', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('release_id');
            $table->unsignedTinyInteger('position');
            $table->unsignedBigInteger('stage_id');
            $table->unique(['release_id', 'position']);
            $table->index('stage_id');
        });
        Schema::create('dandori_permissions', function (Blueprint $table) {
            $table->string('user_id', 191)->primary();
            $table->string('granted_by', 191);
            $table->timestamps();
        });
        Schema::create('dandori_audits', function (Blueprint $table) {
            $table->id();
            $table->string('user_id', 191);
            $table->string('operation', 32);
            $table->json('details');
            $table->timestamp('created_at');
        });
    }

    public function down(): void
    {
        foreach (['dandori_audits', 'dandori_permissions', 'dandori_slots', 'dandori_releases', 'dandori_stages', 'dandori_locks'] as $table) {
            Schema::dropIfExists($table);
        }
        Schema::table('stages', function (Blueprint $table) {
            $table->dropUnique(['stage_code']);
            $table->dropColumn('stage_code');
        });
    }
};
