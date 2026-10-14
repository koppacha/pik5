<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('players', static function (Blueprint $table) {
            $table->unsignedInteger('take_count')->default(0)->after('last_take_at');
        });

        Schema::table('trick_card_payments', static function (Blueprint $table) {
            $table->dropUnique('trick_card_payments_event_id_deck_id_player_name_unique');
            $table->string('payment_type', 32)->default('initial_post')->after('player_name');
            $table->unsignedInteger('submission_number')->nullable()->after('payment_type');
            $table->string('idempotency_key', 96)->nullable()->after('record_id');
        });

        DB::table('trick_card_payments')->orderBy('id')->chunkById(500, static function ($payments): void {
            foreach ($payments as $payment) {
                DB::table('trick_card_payments')->where('id', $payment->id)->update([
                    'submission_number' => 1,
                    'idempotency_key' => 'legacy-initial-'.$payment->id,
                ]);
            }
        });

        Schema::table('trick_card_payments', static function (Blueprint $table) {
            $table->unique(
                ['event_id', 'event_card_id', 'idempotency_key'],
                'trick_payments_idempotency_unique',
            );
        });
    }

    public function down(): void
    {
        Schema::table('trick_card_payments', static function (Blueprint $table) {
            $table->dropUnique('trick_payments_idempotency_unique');
            $table->dropColumn(['payment_type', 'submission_number', 'idempotency_key']);
        });

        Schema::table('players', static function (Blueprint $table) {
            $table->dropColumn('take_count');
        });
    }
};
