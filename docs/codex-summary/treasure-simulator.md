# お宝価値シミュレーター

- 対象はピクミン2チャレンジモードのステージID 201〜230。レガシーDB `pik4.sql` の `object_list` は対応する30ステージをID 245〜274で保持するため、現行IDはレガシーIDから44を引く。
- 元データは475行、個数展開後763個。各行にはフロア、名前、個数、日本NGC版の単価があり、すべて `count × price = sum_price` を満たす。
- `laravel/database/seeders/data/stage_treasures.csv` は `object_list` の該当行から抽出したデータ。`legacy_object_id` は元データとの照合用。新規テーブル `stage_treasures` へは `php artisan migrate --path=database/migrations/2026_09_27_000001_create_stage_treasures_table.php` と `php artisan db:seed --class=StageTreasureSeeder` で投入する。Seederは対象ステージを入れ直すため再実行可能。
- 現行 `stages.treasure` と元データの合計は29ステージで一致する。ステージ206「地下の温室」のみ現行表示891ポコに対し元データ926ポコで、35ポコ差がある。原因は未確定のため元データの各行は変更せず、シミュレーター内で差を説明する。
- Laravel API `GET /api/stage/{id}/treasures` がデータを返す。Next.jsの `stage/[...stage]` は201〜230でビルド時に取得し、ヘッダーのお宝価値からシミュレーターを開く。
- 地域別データは [Pikipediaのお宝一覧](https://www.pikminwiki.com/List_of_Pikmin_2_treasures) の日本名・価格・重さを対象ステージの項目と照合して抽出した。原生生物の重さは [Piklopedia](https://www.pikminwiki.com/Piklopedia_%28Pikmin_2%29) を参照した。地域で配置品が入れ替わるステージは各ステージの記事も照合した。
- 475行すべてに `weight_jp` があり、`value_na` / `value_eu` は各3行、`weight_na` / `weight_eu` は各4行に差分のみを記録する。空欄は日本版と同じ値として扱う。日本版価値はレガシーDBの475行すべてと一致した。
- 地域切替は JP (NGC / Wii)、NA (Switch)、EU。チェック状態を維持して単価と合計を更新し、行ごとに選択地域の重さを表示する。NA (Switch) の数値にはPikipediaの北米版数値を適用する（同サイトによるとSwitch版は主に北米版のお宝構成を採用）。
- シミュレーターでは選択中の地域ボタンをテーマの文字色と背景色を反転して強調する。ステージ名は太字・1.2em、各行の価値と重さは一行に表示する。
- お宝の一括選択ボタンは `全チェック → カギのみ → 全解除` の操作を循環する。各操作は現在のチェック状態を上書きし、個別チェックでは次の操作順を変えない。
- 地域別カラムは `2026_09_27_000002_add_regional_treasure_data.php` で追加する。既存環境ではこのマイグレーション後に `StageTreasureSeeder` を再実行する。
