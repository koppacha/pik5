# Records And Scoring

## 記録投稿

- 投稿経路は `RecordForm -> /api/server/post -> Laravel RecordController`。
- `/api/server/post` の疎通確認には NextAuth 認証 cookie と multipart POST が必要。
- `/api/server/post` の再現には専用テストユーザー `codex_post_api_test` を使う。
- 専用テストユーザーのパスワードは Git に記録せず、`PIK5_POST_TEST_PASSWORD` 環境変数で指定する。
- `next/prisma/seed.ts` は `PIK5_POST_TEST_PASSWORD` がある場合のみ、専用テストユーザーを作成・更新する。
- 投稿 API の再現では `stage_id=399` が使われている。
- 正常系は `postStatus 200` と `["OK",200]`。
- `502 {"error":true,"message":"proxy error"}` の場合は `next/pages/api/server/post.js`、`next/lib/prisma.js`、`next/lib/prismaConnection.js` を確認する。
- テスト投稿は DB に残るため、必要なら MySQL コンテナ内で該当レコードを削除する。

## 新規登録者の証拠要件

- 新規登録者は「登録日が満30日未満、または投稿数が30未満」。
- 証拠要件はルールIDごとに `next/lib/const.js` へ定義する。
- 要件値が自然数なら、その順位以上の記録に証拠コンテンツが必要。
- 要件値 `0` は不要、`q` は順位に関係なく必要。
- 1番目の値は証拠動画、2番目の値は証拠画像。
- 証拠画像が必要なケースでも、証拠動画が添付されていれば画像提出義務は免除。
- データにないルールIDの投稿はチェックしない。期間限定などは原則対象外。
- rule `91` は `q,0` だが、`stage_id` が `901` または `902` の場合のみ動画不要・画像必須という例外がある。
- このバリデーションはフロント yup だけでなく Next API 側にも入れる。

## スコア表示

- `score2str(score, rule, stage)` は `next/lib/factory.js` に置く方針。
- カウントダウン系ステージは、DB上の score が「残り秒数」。`timeStageList` の制限時間から差し引いて経過時間へ変換する。
- カウントダウン系の例: `[338, 341, 343, 345, 346, 347, 348, 349, 350]`。
- カウントアップ系 rule `[29,35,47,91]` は score が経過時間なので時間フォーマットに変換する。
- それ以外は通常スコアとして表示する。
- `Score` コンポーネントは `score=0` を非表示にしがちなので、イベント総合など 0 表示が必要な場合は `showZero` のような明示フラグを使う。
- タイムアタック系総合 rule `[29,35,47]` の総合点は、各ステージで `max(0, 600 - score)` を計算して合計する。`TotalController::scoreForTotal()` を総合ランキングとユーザーページ集計の共通処理として使う。

## ランク/参考スコア

- `RankingStandard` は「記録の前に必要な参考スコアをすべて挿入してから記録本体を追加」する。
- 複数の参考スコアが連続する場合、記録を挟まず `参考スコアA -> 参考スコアB -> 記録` の順にする。
- `RankingTotal` は既に同じ方針の先例。
- 段位ボーダーや参考スコアの表示条件は、総合/単体ランキングで既存ロジックの添字対応を壊さない。

## ダンドリバトル

- `next/pages/battle/index.js` では、ランダムID、レート計算、同点処理、payload の取り違えに注意。
- 同点時リワードは「該当順位の合算を等分」し、順位も再計算する。
- ボーダー計算では `rank=0` を排除し、`rank >= 1` を使う。
