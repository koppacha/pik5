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
        Schema::create('totals', static function (Blueprint $table) {
            $table->id('id');
            $table->string('user_name');
            $table->string('t000'); // 通常総合
            $table->string('t001'); //
            $table->string('t002'); //
            $table->string('t003'); //
            $table->string('t004'); //
            $table->string('t005'); //
            $table->string('t006'); //
            $table->string('t100');
            $table->string('t101');
            $table->string('t102');
            $table->string('t200');
            $table->string('t201');
            $table->string('t202');
            $table->string('t210'); // タマゴあり
            $table->string('t211'); //
            $table->string('t212'); //
            $table->string('t220'); // タマゴなし
            $table->string('t221'); //
            $table->string('t222'); //
            $table->string('t230'); // 本編地下
            $table->string('t231'); //
            $table->string('t232'); //
            $table->string('t240'); // タマゴムシ縛り
            $table->string('t241'); //
            $table->string('t242'); //
            $table->string('t250'); // スプレー縛り
            $table->string('t251'); //
            $table->string('t252'); //
            $table->string('t260'); // 2Pチャレンジ
            $table->string('t270'); // ソロバトル
            $table->string('t271'); //
            $table->string('t272'); //
            $table->string('t300'); //
            $table->string('t302'); //
            $table->string('t303'); //
            $table->string('t304'); //
            $table->string('t305'); //
            $table->string('t306'); //
            $table->string('t310'); // お宝をあつめろ！
            $table->string('t312'); //
            $table->string('t313'); //
            $table->string('t314'); //
            $table->string('t315'); //
            $table->string('t316'); //
            $table->string('t320'); // 原生生物をたおせ！
            $table->string('t322'); //
            $table->string('t323'); //
            $table->string('t324'); //
            $table->string('t325'); //
            $table->string('t326'); //
            $table->string('t330'); // 巨大生物をたおせ！
            $table->string('t332'); //
            $table->string('t333'); //
            $table->string('t334'); //
            $table->string('t335'); //
            $table->string('t336'); //
            $table->string('t340'); // 2Pミッション
            $table->string('t350'); // ソロビンゴ
            $table->string('t352'); //
            $table->string('t353'); //
            $table->string('t354'); //
            $table->string('t355'); //
            $table->string('t356'); //


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
        Schema::dropIfExists('totals');
    }
};
