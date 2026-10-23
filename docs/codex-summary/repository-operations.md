# 構成とリポジトリ運用

## 構成

- `next/`：Next.js Pages Router、React、MUI、styled-components、NextAuth、Prisma、SWR。
- `laravel/`：Laravel API、業務データ、集計、migration、Seeder、scheduler。
- 認証用Prisma DBとLaravel業務DBは別接続であり、同一DBと仮定しない。`records` / `decks` / `trick_*` はLaravel経由で扱う。
- `docker-compose.yml` のサービスは `next`、`laravel`、`scheduler`、`mysql`、`redis`。`laravel-scheduler` はコンテナ名でありComposeサービス名ではない。
- `mysql/`、`redis/`、`log/mysql/`、`backups/` はローカルデータ・退避領域。通常の探索・コンテキストへ含めない。
- `laravel/project.json` がアプリバージョンのソース。`config/version.php` が投稿IDのprefixを算出し、欠落・不正時は300へフォールバックする。個別ファイルのbind mountは追加しない。

## 開発

- `.env` を既に設定済みなら上書きしない。初回だけ `sample.env` を元に用意し、値は出力しない。
- `docker compose up -d` でサービスを起動する。Nextはbase Composeでは `sleep infinity` のため、別途 `docker compose exec next yarn dev` が必要。
- Nextはホスト `http://localhost:3005`、コンテナ内 `http://localhost:3000`。Laravelは内部 `http://laravel:8000`、base Composeは8000をホスト公開しない。
- Nextの `predev` / `prebuild` は `prisma generate`。依存・生成物・DB migrationの適用は別々に確認する。
- `.next` を共有するdev/buildを同時実行しない。別出力は `NEXT_DIST_DIR` で指定できるが、プロセス・ポート・型生成物も含め隔離する。
- [配備と環境](deployment-and-environment.md)、[DB復旧手順](../database-recovery.md)を必要時に読む。

## Git

- 既存未コミット変更は戻さず、今回の変更と区別する。Gitのcommit / push / mergeはユーザーの依頼範囲に従う。
- ユーザー方針：`limited-trick` は継続開発用として保持し、完成単位を通常mergeで `master` へ統合する。強制push・rebase・ブランチ削除は通常運用に使わない。
- commitは既存の `ver.X.XX <要点>` 形式を参考にする。PRには利用者向け変更、UI画像、migration / Seederの有無、検証と制約を記す。
- 動的ルートのパスはシェルで引用する（例：`'next/pages/stage/[...stage].js'`）。
- IDE設定とPrisma生成物を新規追跡しない。既に追跡されている場合のindex整理は別途対象を確認する。
- 統計は依頼された場合に `node docs/scripts/update-stats.mjs` で `docs/stats.html` を再集計する。ログも読む処理なので通常のdocs整理では実行しない。

## 公開前の履歴整理

- ユーザーの明示依頼による秘密情報除去は通常のmerge運用と別に扱う。非公開bundleで全refを保存し、隔離コピーで内容・構文・Git構造を検証してから対象refを原子的に更新する。
- ローカルブランチの整理だけではリモート、他クローン、reflog、復旧用ref・bundleの旧情報は消えない。これらの公開・mirror pushを避け、旧履歴の再混入を確認する。強制pushや資格情報の有効性確認を付随実行しない。
- 2026-10-24の対象範囲と検証は [履歴点検](../history-publication-audit-2026-10-24.md) を参照する。
