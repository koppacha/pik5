# Limited Ideas

- トップページの「次のイベント」と「新着キーワード記事」の間に `next/components/top/LimitedIdeas.js` を表示する。既存キーワード投稿とは独立した機能。
- 公開期間は日本時間2026/09/13 00:00:00〜2026/11/06 19:59:59。期間外は管理者（DB上のrole=10）のみ画面・APIを利用可能。終了時刻は暫定。
- 日時設定は `next/lib/limitedIdeas.js` に集約する。`LIMITED_IDEAS_END` は排他的な終了境界なので、19:59:59まで公開する場合は20:00:00を設定する。
- APIは `/api/limited-ideas`。GETは公開期間内の応募総数、`?view=mine&page=0` は認証必須の管理一覧（50件ずつ）。管理者には全員分を返すが、`ownCount` は管理者本人の件数。
- POSTは新規登録、PUTは編集、DELETEは論理削除。PUT/DELETEは `ruleId` と取得時の `revision` が必須。同時更新・古いリビジョンは409で拒否する。
- NextAuthの `dbId` からUserのID・名前・ロールだけを取得し、権限をDBで再確認する。クライアント指定のロール・作成者・編集者・非表示フラグは採用しない。
- 書き込みはJSON・同一Origin必須。運用環境の `NEXTAUTH_URL` は実際のブラウザ側オリジンに合わせる。リクエスト本文上限8KB。全レスポンスはprivate/no-store。
- Prismaモデル `LimitedIdea` はMySQLの `limitedIdeas` テーブルに対応する。主キーは `ruleId` + `revision`。新規登録ごとにUUIDを発行する。
- 最新行だけ `currentKey=ruleId` を持ち、旧リビジョンの `currentKey` はNULL。unique制約とトランザクション内の条件付き更新で競合を防止する。本文等の旧データは上書きしない。
- 削除も `hidden=true` の新リビジョンを追加する。過去行を含め物理削除しない。作成者ID・作成者名と編集者IDを各行に保持し、作成者名を画面に表示する。
- 応募総数は最新かつ非表示でないユニークなルールの件数。倍率は件数÷200、最低1.00倍、小数第2位まで四捨五入。
- タイトル・ステージ名には既存の `next/locale` を利用する。タイトル2は201〜230、タイトル4は401〜428。文字数はUnicodeコードポイントでルール名10文字、本文256文字。ユーザー入力はHTMLとして描画しない。
- ローカルには `20260911000000_add_limited_ideas` を適用済み。本番反映時にはNext環境で `npx prisma migrate deploy` とPrisma Client再生成（既存prebuildで実施）が必要。

## 検証

- 全体 `yarn lint`、`tsc --noEmit --incremental false` を実施。
- `next/tests/limitedIdeas.test.js` を `node --import tsx --test tests/limitedIdeas.test.js` で実行する。通常はDB以外のテストを実行する。
- DB統合テストには `LIMITED_IDEAS_TEST_DATABASE_URL` を指定する。誤接続防止のため127.0.0.1の `limited_ideas_test` DBのみ許可する。専用一時MySQLに今回のmigration.sqlを適用して使用する。既存ローカルDB・ユーザー認証情報は使わない。
- 統合テストは実MySQLで公開境界、管理者例外、他者の編集・削除拒否、CSRF、入力検証、履歴保持、作成者と編集者の分離、同時更新競合、論理削除と応募総数を確認する。
- ブラウザ検証は専用セッションのAPIレスポンスをテストデータへ差し替え、390px幅のフォーム・一覧、タイトル/ステージ連動、注意事項、下書き保持、作成・編集・削除、HTML非解釈、未ログイン表示を確認する。実APIの公開前403も別途確認する。

## 管理一覧のレイアウト

- 管理一覧は「操作・タイトル・難易度・更新日時・ユーザー名」のヘッダー付き5列CSS Grid。全行で列幅を共有し、各セルに罫線を表示する。タイトルとユーザー名は可変幅、操作・難易度・日時は必要幅を確保する。スマホは一覧領域内の横スクロールで対応する。

## 旧システムの応募ルール取り込み（2026-09-12）

- 専用Seederは `next/prisma/seed-limited-ideas.ts`。通常の `prisma/seed.ts` とは独立して実行する。
- 添付MySQL出力81行を `prisma/fixtures/limited-ideas-legacy.json` の48件に変換済み。生のSQL文は実行しない。元ファイルは本番実行時には不要。
- `unique_id` ごとに最新の `updated_at` の行を採用し、`created_at` は全履歴の最小値。旧日時は日本時間としてUTCへ変換する。発案者は採用行の `last_editor` を `User.userId` と照合して各環境のDB主キーへ変換し、表示名には対応するUser.nameを使う。
- 旧IDを `legacyId` に残す。旧IDから決定的に生成するUUIDを `ruleId` にして、リビジョン1として保存する。タイトルはステージIDの百の位から算出する。
- 難易度は既存スキーマがnull非許容のため1、登録方法はscore、hidden=false。
- 旧ルールの例外的な文字数超過を保持するため、`20260912000000_allow_legacy_limited_ideas` はruleNameをTEXT、bodyをMEDIUMTEXTに拡張しlegacyIdを追加する。UI/APIの新規・編集時制限は10文字・256文字のまま。旧行を削除する場合は文字数を直す必要はない。
- `shino15nome` が存在しない場合だけ名前を同じユーザーIDとして新規登録する。password=null、管理者権限なしなので開発環境ではログイン不可。本番に既存アカウントがあればそのIDと名前を使い、パスワード・名前・権限などを変更しない。他の発案者が見つからなければ投入を中断する。
- 既存ルールは削除・上書きしない。取り込み済みの旧IDは再投入しないため、取り込み後の編集や論理削除も維持する。ユーザー追加、ルール追加、件数検証は1トランザクション。
- 公開期間・権限は既存APIに従う。発案者の閲覧・編集・削除は2026/09/13 00:00 JSTから募集終了まで。管理者は期間外も利用可能。

### 本番への適用手順

本番のNext環境で、今回のコード・fixture・マイグレーションを配置した後に、`next/` をカレントディレクトリとして実行する。

```bash
npx prisma migrate deploy
npx prisma generate
npx tsx prisma/seed-limited-ideas.ts --dry-run
npx tsx prisma/seed-limited-ideas.ts
```

Docker Compose環境では各コマンドの先頭に `docker compose exec -T next` を付けてリポジトリ直下から実行できる。既存のNextプロセスは、更新したPrisma Clientが使われるよう通常のデプロイ手順で再起動する。

- dry-runはDBを変更せず、sourceRules・toCreate・usersToCreate・visibleBefore・expectedVisibleAfterを表示する。
- 初回はsourceRules=48、created=48、activeImported=48が期待値。既存ルールがあればその件数を加算したものがvisibleAfter（応募総数）になる。
- 再実行時はcreated=0。取り込み後に編集・削除したルールを元に戻さない。削除があればactiveImportedは48より少なくなる。
- アプリが参照するものと同じ `currentKey IS NOT NULL AND hidden=false` 条件で件数を照合する。
- 今回は開発環境のみ実行済み。本番環境では未実行。

### 開発環境の実行結果

- 入力81行 → 有効48件、発案者12名中11名が既存、1名追加。
- 初回投入48件、既存1件保持、応募総数49件。旧ルール名が10文字を超える3件も保存済み。
- 再実行は追加0件・ユーザー追加0名で総数49件を維持。
- 全48件の名前・本文・発案者・日時・ステージを元データと照合済み。既存データは投入前後の内容ハッシュ一致を確認済み。
- 独立した一時MySQLで、パーサー、dry-run、長文保存、文字数制限、発案者・管理者・第三者の権限、再実行時の編集・削除保持を検証。既存APIのテストを含め9テスト通過。Lint・型チェックも通過。
- 検証コードは `next/tests/legacyLimitedIdeas.test.js`。DBテストは既存と同様、127.0.0.1の専用 `limited_ideas_test` DBだけを許可する。

## リリース前確認

- 2026-09-12に差分の簡易セキュリティ・バグチェックを実施。報告対象の脆弱性・重大バグなし。隔離MySQLの9テスト、Lint、型チェック、2本のmigration SQL、Laravelバージョン設定の読み込みを再確認。
- push後の本番手順は `docs/release-2026-09-12.md`。バックアップ、Next停止、migration、専用Seeder、Laravel設定キャッシュ更新、コンテナ再作成、Nextビルド・起動、件数確認が必要。本番は未実行。
