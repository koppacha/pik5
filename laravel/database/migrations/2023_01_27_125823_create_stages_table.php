<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     *
     * @return void
     */
    public function up(): void
    {
        Schema::create('stages', static function (Blueprint $table) {
            $table->id('stage_id');
            $table->bigInteger('parent');
            $table->bigInteger('Time');
            $table->bigInteger('Max_Treasure');
            $table->bigInteger('Total_Pikmin');
            $table->bigInteger('Red_Pikmin');
            $table->bigInteger('Yellow_Pikmin');
            $table->bigInteger('Blue_Pikmin');
            $table->bigInteger('Purple_Pikmin');
            $table->bigInteger('White_Pikmin');
            $table->bigInteger('Rock_Pikmin');
            $table->bigInteger('Winged_Pikmin');
            $table->bigInteger('Bulbmin');
            $table->bigInteger('Ultra_Spicy');
            $table->bigInteger('Ultra_Bitter');
            $table->bigInteger('wr');
            $table->bigInteger('wrdx');
            $table->bigInteger('border_line');
            $table->bigInteger('border_line_701k');
            $table->bigInteger('border_line_702k');
            $table->bigInteger('unexpected');
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     *
     * @return void
     */
    public function down()
    {
        Schema::dropIfExists('stages');
    }
};
