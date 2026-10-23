# ドキュメント整理・照合記録（2026-10-15）

## 対象と整理

- `docs/` の現行サマリー24本、コマンド集、DB復旧、Prisma移行・過去リリース・企画書を分類し、`docs/README.md` に索引を作成した。
- 旧24サマリーと汎用コマンド集は `docs/archive/` に保持。現行サマリーから作業経過・単発の本番訂正・測定値・後続訂正前の説明を外した。通常は共通方針・構成・テスト方針と対象機能のみ参照する。
- ルートAGENTS.mdもログの扱い・テスト・起動・専用ユーザー手順を同期した。作業ログは保存し、通常コンテキストへ自動投入せず、必要な履歴調査時の参照は可能とした。

## 主な訂正と照合先

| 旧説明・混在 | 現行の説明 | 実装の確認先 |
| --- | --- | --- |
| ステージ・総合はISR | SSR、private/no-store | `next/pages/stage/[...stage].js`、`total/[...series].js` |
| 成績CSVを全truncate | 衝突検査・transaction・upsert、CSV外保持 | `EventResultCsvSeeder.php`、対応Featureテスト |
| Laravel全proxy信頼 | 設定CIDRと署名付き接続元 | `TrustProxies.php`、`VerifiedClientIp.php`、`requestContext.js` |
| 名前付き60回/分が有効 | apiグループはthrottle:1800,1、名前付き定義は未接続 | `Http/Kernel.php`、`RouteServiceProvider.php` |
| laravel-schedulerをCompose操作に指定 | サービス名scheduler、コンテナ名laravel-scheduler | base / prod Compose |
| 本番Nextもsleepのみ | 本番overrideはbuild後start | `docker-compose.prod.yml`、`next/package.json` |
| 専用ユーザー作成に通常seed | 実ユーザー資料もimportするため禁止、専用Userのみ作成 | `next/prisma/seed.ts`、`docs/testing-post-api.md` |
| フロントはlint / 手動だけ | Nodeテスト、専用MySQL、Playwrightも存在 | `next/tests/`、大会配下testsとconfig |
| SQLite非互換で全体テスト停止 | 対応分岐あり、現状は旧認証7件失敗 | migration、phpunit設定、CreatesApplication、全体実行 |
| 第19回の経過・未反映追記 | 現行契約と配備記録を分離、第20回は計画正本へ | `TrickScoreOrder`、Record公開scope、各機能仕様・配備記録 |

## 今回実行した検証

- `docker compose exec -T laravel php artisan test`：209成功・7失敗。6件は旧UserFactoryとusers schema不一致、1件はRedirectIfAuthenticatedの戻り値型不一致。SQLiteインメモリの二重保護を確認して実行した。
- `next/` で `node --import tsx --test tests/limitedIdeas.test.js tests/legacyLimitedIdeas.test.js tests/pickupVideo.test.js tests/serverFetchJson.test.mjs tests/security-and-dandori.test.cjs`：18成功・MySQL2件スキップ。初回はHTTPサーバーlisten EPERM、必要権限で再実行して解消。今後の推奨手順には専用DB変数の除外とファイル間直列実行を明記した。
- `python3 next/pages/limited/tricks/tests/tricks-v20-test.py`：8成功。
- `python3 next/pages/limited/tricks/tests/tricks-personalities-test.py`：10成功。先に試したunittest discoverは0件だったため成功扱いにせず直接実行した。
- 現行索引・サマリー等のMarkdownリンク、主要参照スクリプトの存在、文書内JS例の構文、`git diff --check` を確認した。

## 未実施・残課題

- 今回はドキュメント改修であり、アプリ実装・既存の未コミット実装差分は変更していない。旧認証7件の修正や廃止は独立タスク。
- 専用MySQLの統合・競合、実ログイン・投稿・管理API、Playwright、lint / 本番buildは今回未実施。投稿手順の新しい例は静的照合・構文確認であり実DBへ投入していない。
- 本番へ接続していない。本番のHEAD・migration適用・proxy / WAF / 国情報・ポートの現状は未確認。過去の配備記録を現在の検証結果へ読み替えない。
- アリーナ・お宝・キーワードの専用自動テスト不足、現行NextAuth / OTP / resetの統合・並行テストは、該当機能変更時に優先して検討する。
- ドキュメントの照合は主要契約・設定・テストを中心に行った。全画面・全APIの実動作を保証するものではない。
