# 配備と環境

> 2026-10-15にCompose・Dockerfile・起動scriptを静的照合。本番へ接続しておらず、稼働HEADや設定は未確認。

- base Composeは開発用。本番overrideは `docker compose -f docker-compose.yml -f docker-compose.prod.yml ...`。既存本番の起動方式と実効構成を確認してから操作する。
- Composeサービス名は `scheduler`、コンテナ名は `laravel-scheduler`。build / upの対象は `laravel scheduler`。
- 本番overrideのNextは `yarn build && exec yarn start` とrestartを使う。旧説明の「本番も常駐のみ」は使わない。単一Nextを作り直す反映は停止時間を伴う。無停止切替の調査結果を配備済み構成と解釈しない。
- LaravelはPHP8.2 FPM Bookworm、dumpクライアントはDockerfileで導入。Dockerfile変更はpullだけでは反映されない。Laravelとscheduler双方の再build / recreateが必要。
- `.dockerignore` の秘密情報・DB・生成物除外、ディレクトリmount、`laravel/project.json` の参照を維持する。
- Compose由来の環境変数変更はコンテナ再作成、Laravel設定変更はconfig cache更新、Nextのコード・依存・生成client変更はbuild / process反映を確認する。秘密値は出力しない。

## 反映時の確認

1. 対象差分、既存未コミット変更、依存変更、必要なmigration / Seeder、停止時間、切戻し範囲を確認する。
2. DB変更前はフルバックアップと圧縮整合性を確認する。実ユーザーを含む退避は非公開に保つ。
3. PrismaとLaravelの必要な追加migrationをそれぞれ適用する。Seederは対象の初期化範囲・再実行可否を確認し限定する。
4. 対象サービスを既存運用に従って更新する。devとbuildの出力競合、build失敗による再起動ループに注意する。
5. 起動状態、build結果、トップ・ログイン・投稿・主要ランキング、必要な非公開境界と履歴保持を確認する。実施範囲と未確認事項を記録する。

## DB保護・運用障害

- [DBバックアップと復旧](../database-recovery.md)を手順の正本とする。ローカルは日次フル2日・binlog3日、本番overrideはフル既定14日・binlog30日。ローカル破壊的操作直前には新規取得し、検証完了まで後続binlogも保持する。
- 本番overrideは破壊的Artisanコマンドのガードを強制する。直接SQL・Prisma・アプリ処理はガード対象外。ランタイムとmigrationの権限分離は別途必要。
- Telescopeはrequire-dev。本番 `--no-dev` で存在しなくても起動できる条件付き登録を維持する。
- RedisのRDB保存失敗によるMISCONFは書込権限と保存状態を確認し、既存RDBを削除しない。
- Discord未設定は503、上流通信・認証失敗は502。`laravel/.env` やcacheの反映を存在判定だけで確認し、トークンを表示しない。
- ルール48・認証履歴の追加実装はローカル作業ツリーに存在する。本番側WAF / GeoIP / proxy CIDR / ポートは別途確認が必要。[実装詳細](../security-and-rule48-implementation.md)。
- 過去リリースの時刻・HEAD・実測値は機能ディレクトリの配備記録または [整理前資料](../archive/summary-2026-10-15/deployment-and-environment.md)を必要時のみ参照する。

## 本番Nginx

- 2026-10-24に対象ホストの実効設定を確認し、Nginxのみ反映。サイト実体は `/etc/nginx/sites-available/pik5.conf`、追加zoneは `/etc/nginx/conf.d/pik5-rate-limits.conf`。リポジトリの `nginx.pik5.conf` / `nginx.pik5-http.conf` と有効ディレクティブを揃える。
- 認証APIは10r/s・burst20、一般APIは30r/s・burst60の別IP枠。静的アセットを動的枠から外す。共有perip（2r/s）とNext dataの既存枠は他サイトにも関係するため独断で変えない。
- 直接公開の入口でHost / forwarded host / HTTPS / 実接続IPを上書きする。X-Forwarded-Forは `$remote_addr`。CDN等を前段へ追加する場合は信頼境界と実IP判定を再設計する。
- 反映は管理者限定のバックアップ・候補差分確認・`nginx -t`・reload・実効設定とHTTPの確認の順。ローカルファイルを置くだけで本番反映済みと判断しない。実施結果・切戻しは [トップ429の調査記録](../top-reload-429.md) を参照。
- このNginx反映は、Next/Laravelのローカル修正を配備した意味ではない。
