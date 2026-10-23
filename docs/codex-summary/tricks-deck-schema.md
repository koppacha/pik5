# トリックカードとスキーマ

- カード本体は `decks`、大会内状態・レア度・トップ投稿者は `trick_event_cards`。旧ruleName / topPlayer / stageId / rarity列は削除済みのスキーマを前提とする。
- 正規列はrule_name / origin_stage_id等。origin_stage_idは元ステージ、stage_idは投稿先であり互換変換しない。旧移行は同大会の確定レア度保持・競合拒否・migration順序の検証が必要。
- draw_countは初回1、以後was_opened=true。手札返却はレア度保持、捨て札移動とデッキ再循環はレア度 / draw_countをリセットする。
- score_typeはpoints / time、順位方向はscore_order / `TrickScoreOrder`。整数秒・最大999999、同点順位と自己ベスト方向を保存・表示・回収snapshotで揃える。
- `TrickStageAllocator` はsingletonロックを先に取得し、投稿先の採番とdisplayを同期する。大会間の採番衝突をSQLiteだけで保証しない。
- creatorは表示文字列。CSV列はcard_key, origin_stage_id, title, rule_name, text, difficulty, creator, score_type。[CSV仕様](../../next/pages/limited/tricks/docs/tricks-production-card-csv.md)を参照する。
- 第19回初期160枚は `TrickProduction261009Seeder`、追加160枚は `TrickReplenish261009Seeder`。clone_source_deck_idで二重投入防止し、独自DESCも引き継ぐ。補充後に初期化Seederを再実行しない。
- 公開表示の3桁card_keyと内部card / deck / event_card IDを区別する。同内容の別札は独立し、同一プレイ成果の複数札流用は禁止。
- 旧資料の「migration未適用」やテスト大会初期化記録は現在の適用状態を示さない。必要時は対象環境のmigration履歴を確認する。
