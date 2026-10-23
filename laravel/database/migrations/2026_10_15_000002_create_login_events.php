<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('login_events', function (Blueprint $table) {
            $table->id();
            $table->string('user_id', 191)->nullable()->index();
            $table->string('outcome', 16);
            $table->string('ip', 45)->nullable();
            $table->string('user_agent', 256)->nullable();
            $table->timestamp('created_at')->index();
        });
        Schema::create('security_rate_limits', function (Blueprint $table) {
            $table->string('key', 64)->primary();
            $table->unsignedInteger('attempts');
            $table->timestamp('expires_at')->index();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('security_rate_limits');
        Schema::dropIfExists('login_events');
    }
};
