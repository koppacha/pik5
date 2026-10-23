# トリックルールの参照先

- 第19回の競技仕様は `next/pages/limited/tricks/docs/tricks-rules.md`、UI / API / DBは `tricks-system.md`、実験は `tricks-simulation.md`。
- 第19回終了後のルール変更は `tricks-tournament-20-plan.md` に集約し、同じ作業で採否・仮定・最終更新日・変更履歴を更新する。シミュレーターv20と本番APIの反映状態を分ける。
- 用語はドローポイント・ポット・デッキ・切り札・トリック・期間限定チャレンジ。勝利指標のランクポイントとは別。API / DB英語名とP / DP / R略記は互換性を維持する。
- 第19回の給付は定期の手札+DP<3、成功テイク / 無料初投稿の行動直前<5。テイクは手札消費前に判定する。第20回のテイクコスト基準へ無条件に置換しない。
- 無投稿札の原資は消滅、ポットへ加えない。同順位の余りはテイカーへ。表示原資と実支払は分ける。
- 裁定によるルール編集・論理削除は支払履歴等を保持し、5DP補償・次スロット免除・再送冪等性を維持する。
- [カード](tricks-deck-schema.md)、[UI](tricks-ui.md)、[リプレイ](tricks-replay.md)、[整合性](tricks-rule-consistency.md)を変更対象に応じて参照する。
