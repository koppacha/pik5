# 期間限定ルール応募

- 共通ロジックは `next/lib/limitedIdeas.js` / `limitedIdeasApi.js`、UIは `LimitedIdeas`。Prisma `LimitedIdea` は認証DB側 `limitedIdeas`。Laravel DBへ書かない。
- 公開境界は共通定数で管理し、管理者例外もAPIで検証する。現在は第19回後の再募集に対応し、架空の締切を表示しない。
- 新規は認証必須、編集・削除は発案者または管理者。更新時の現行User照会、same-origin、本文上限8KB、private/no-storeを維持する。
- `ruleId + revision` ごとに履歴を追加。最新行のみ `currentKey=ruleId`、旧行はNULL。条件付き更新とunique制約で競合を防ぐ。削除もhidden=trueの新revisionであり物理削除しない。
- creatorId / creatorNameとeditorIdを分け、作者名と履歴を保持する。有効応募総数は最新かつ非表示でないruleの件数。倍率は件数÷160、最低1.00倍・小数第2位丸め。
- タイトル・許可ステージは `LIMITED_IDEAS_STAGE_RANGES`、名前はlocaleを使う。ルール名10・本文256 Unicodeコードポイント。HTMLとして描画しない。
- 登録方法は `score`（スコア）、`time`（短い時間が上位）、`left`（残り時間が長いほど上位）。既存timeを残り時間に解釈し直さない。応募保存と競技のスコア処理は別機能。
- 旧応募取込は `prisma/seed-limited-ideas.ts`。専用fixture、決定的UUID / legacyId、dry-run、transaction、再実行時の編集・削除保持を使う。通常 `prisma/seed.ts` と混同しない。
- 旧長文用にDBはTEXT / MEDIUMTEXTを許容するが、新規・編集の文字数制限は維持。旧削除に本文修正を要求しない。
- 募集リセットは対象期間と件数を確認し、履歴を残した論理削除で行う。過去の本番件数を現状とみなさず、明示的な依頼・バックアップ・transactionを前提とする。
- 自動テストは `limitedIdeas.test.js` / `legacyLimitedIdeas.test.js`。DB統合は専用 `limited_ideas_test` のみ。2ファイルが同じテーブルを削除するので直列実行する。[テスト方針](testing-and-verification.md)。
