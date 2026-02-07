# Web開発のためのコマンド集（入門・応用・セキュリティ）完全版
対象: **macOS（ローカル開発） + Yarn + Docker** / **SSHでUbuntu本番サーバー運用**

> 注: 各コードブロックは IntelliJ IDEA の Terminal で「まとめて実行」される想定のため、**用途（説明文）ごとにコードブロックを分割**しています。  
> サブカテゴリは `###` を使用しています。

---

## 状況確認基本コマンド

現在のディレクトリを確認する
```shell
pwd
```

実行しているユーザー名を確認する
```shell
whoami
```

OS/カーネル情報を確認する（macOSでも有効）
```shell
uname -a
```

---

## ファイル・ディレクトリ操作（入門）

### 一覧・移動・作成・削除

ディレクトリ配下の一覧を詳細表示する（隠しファイル含む）
```shell
ls -la
```

ディレクトリを移動する
```shell
cd <dir>
```

空ファイル作成 / タイムスタンプ更新をする
```shell
touch <file>
```

ディレクトリを（親ごと）作成する
```shell
mkdir -p a/b/c
```

ファイル/ディレクトリを削除する（強力なので慎重に）
```shell
rm -rf <path>
```

### コピー・移動・リンク

ディレクトリを含めてコピーする
```shell
cp -R src dst
```

移動/リネームする
```shell
mv old new
```

シンボリックリンクを作成する
```shell
ln -s target link
```

（macOS）Finderで現在のディレクトリを開く
```shell
open .
```

---

## ファイル内容の閲覧（ログ/設定の確認）

ファイルを全表示する（小さいファイル向け）
```shell
cat <file>
```

大きいファイルを閲覧する（/で検索、qで終了）
```shell
less <file>
```

ファイルの先頭だけ見る
```shell
head -n 50 <file>
```

ファイルの末尾だけ見る
```shell
tail -n 200 <file>
```

ログを追従表示する
```shell
tail -f <file>
```

---

## 検索（コードベースを掘る）

### 文字列検索

ディレクトリ配下を再帰的に検索する（最小構成）
```shell
grep -R "keyword" .
```

行番号つきで再帰検索する（バイナリ無視も併用）
```shell
grep -RIn "keyword" .
```

（推奨）ripgrepで高速検索する（インストール済みの場合）
```shell
rg "pattern" .
```

### ファイル検索

条件に合うファイルを検索する
```shell
find . -name "*.env*" -maxdepth 3
```

最近更新されたファイルを検索する（例: 1日以内）
```shell
find . -type f -mtime -1 | head
```

（推奨）fdで手軽にファイル検索する（インストール済みの場合）
```shell
fd package.json
```

---

## テキスト処理（ワンライナーで片付ける）

指定範囲だけ表示する
```shell
sed -n '1,120p' <file>
```

（macOS/BSD sed）ファイルをインプレース置換する（-i の後に空文字が必要）
```shell
sed -i '' 's/foo/bar/g' <file>
```

列を抽出する（例: 1列目）
```shell
awk '{print $1}' <file>
```

区切り文字で列を抜く（例: CSVの1列目と3列目）
```shell
cut -d',' -f1,3 <file>
```

件数を集計する（頻出パターン）
```shell
sort <file> | uniq -c | sort -nr
```

CRLFをLFに寄せる（Windows由来の\r除去）
```shell
tr -d '\r' < in.txt > out.txt
```

パイプで渡された入力をまとめて処理する（大量対象に同じ処理を適用）
```shell
cat list.txt | xargs -I{} echo {}
```

---

## 圧縮・展開（配布/バックアップ/ログ退避）

tar.gz を作成する
```shell
tar -czf out.tar.gz <dir>
```

tar.gz を展開する
```shell
tar -xzf out.tar.gz
```

zipを作成する
```shell
zip -r out.zip <dir>
```

zipを展開する
```shell
unzip out.zip
```

---

## 権限・所有者（実行権限/運用上の基本）

実行権限を付与する
```shell
chmod +x script.sh
```

（例）ディレクトリ配下の権限を安全寄りに整える
```shell
chmod -R u+rwX,go-rwx <dir>
```

所有者を変更する（必要時のみ）
```shell
chown -R user:group <path>
```

デフォルト作成権限（umask）を確認する
```shell
umask
```

---

## プロセス・ジョブ・ポート（開発サーバーの“残り”対策）

プロセスをざっくり確認する
```shell
ps aux | head
```

CPU使用率順に並べる（上位だけ）
```shell
ps aux --sort=-%cpu | head
```

メモリ使用率順に並べる（上位だけ）
```shell
ps aux --sort=-%mem | head
```

プロセスを終了する
```shell
kill <pid>
```

強制終了する（最終手段）
```shell
kill -9 <pid>
```

シェルのジョブ一覧を確認する
```shell
jobs
```

ジョブをフォアグラウンドに戻す
```shell
fg %1
```

ジョブをバックグラウンドに送る
```shell
bg %1
```

（macOS）特定ポートを掴んでいるプロセスを特定する
```shell
lsof -iTCP:3000 -sTCP:LISTEN
```

---

## リソース監視（CPU/メモリ/ディスク）

リアルタイムにプロセス状況を見る
```shell
top
```

（Ubuntu等）メモリ使用状況を確認する
```shell
free -h
```

（macOS）メモリ統計を見る
```shell
vm_stat
```

ファイルシステムの空き容量を確認する
```shell
df -h
```

ディレクトリ配下の容量を確認する（macOS: -d が利用可能）
```shell
du -hd 1 .
```

特定ディレクトリの容量を確認する
```shell
du -sh node_modules
```

---

## ネットワーク疎通（HTTP/TLSの切り分け）

HTTPのレスポンスヘッダーを含めて確認する
```shell
curl -i http://localhost:3000
```

先頭だけ確認する（大量レスポンスのとき）
```shell
curl -sS http://localhost:3000 | head
```

ステータスコードと応答時間だけ出す（監視/切り分けに便利）
```shell
curl -sS -o /dev/null -w '%{http_code} %{time_total}\n' http://localhost:3000/
```

TLS/証明書ハンドシェイクを確認する（原因切り分け）
```shell
openssl s_client -connect example.com:443 -servername example.com
```

---

## Git（IDEと併用しても速い領域）

変更状況を確認する
```shell
git status
```

差分を確認する
```shell
git diff
```

ステージ済み差分を確認する
```shell
git diff --staged
```

履歴を俯瞰する（ブランチ迷子対策）
```shell
git log --oneline --decorate --graph --all
```

対話的に追加する（小さく安全にコミット）
```shell
git add -p
```

キーワードをリポジトリ内検索する
```shell
git grep "keyword"
```

作業を退避する（未追跡も含める）
```shell
git stash -u
```

---

## Yarn / Node（本番・ローカル共通で便利）

NodeとYarnのバージョンを確認する
```shell
node -v
```

```shell
yarn -v
```

依存をインストールする
```shell
yarn install
```

依存を追加する
```shell
yarn add <pkg>
```

dev依存を追加する
```shell
yarn add -D <pkg>
```

scriptsを実行する（例: dev）
```shell
yarn run dev
```

```shell
yarn run build
```

```shell
yarn run test
```

キャッシュを削除する（問題切り分け）
```shell
yarn cache clean
```

---

## Docker / Docker Compose（開発・本番どちらでも）

サービスを起動する（バックグラウンド）
```shell
docker compose up -d
```

サービスを停止・片付ける
```shell
docker compose down
```

起動状況を確認する
```shell
docker compose ps
```

ログを追従する（直近200行）
```shell
docker compose logs -f --tail=200
```

コンテナ内でシェルを開く
```shell
docker compose exec <svc> sh
```

サービスを再起動する
```shell
docker compose restart <svc>
```

Dockerのディスク使用量を確認する
```shell
docker system df
```

ビルドキャッシュを掃除する（慎重に）
```shell
docker builder prune
```

コンテナとホスト間でファイルをコピーする
```shell
docker cp <container>:<path> <localpath>
```

```shell
docker cp <localpath> <container>:<path>
```

---

## SSH / 転送（本番サーバー運用の定番）

SSHで接続する
```shell
ssh user@host
```

SCPでディレクトリを転送する
```shell
scp -r dist user@host:/var/www/app
```

rsyncで差分転送する（--deleteは慎重に）
```shell
rsync -av --delete dist/ user@host:/var/www/app/
```

---

## 追加で入れると加速する便利コマンド（任意）

### インストール（macOS/Homebrew）

よく使うCLIをまとめて入れる（任意）
```shell
brew install ripgrep fd jq fzf bat
```

### 補助コマンド

JSONを整形・抽出する（jq）
```shell
cat data.json | jq '.'
```

曖昧検索でファイル/履歴を引く（fzf、設定によりキー操作が増える）
```shell
fzf
```

catの強化版で見る（bat）
```shell
bat <file>
```

---

# ここから: SSHでUbuntu本番サーバー運用（監視・セキュリティ・侵入疑い）

## 本番: webアプリ監視（CPU/メモリ/ディスク/サービス/ポート）

### 全体状況

負荷と稼働時間を確認する
```shell
uptime
```

プロセスをリアルタイム監視する
```shell
top
```

メモリ使用状況を確認する
```shell
free -h
```

ファイルシステムの空き容量を確認する
```shell
df -h
```

inode枯渇を確認する
```shell
df -i
```

### 詳細監視（入っていれば便利）

より見やすく監視する（htop）
```shell
htop
```

CPU/IO統計を一定間隔で見る（vmstat）
```shell
vmstat 1
```

IO詳細を監視する（iostat、要: sysstat）
```shell
iostat -xz 1
```

### systemdサービス監視

特定サービスの状態を確認する
```shell
systemctl status <service>
```

稼働中のサービス一覧を確認する
```shell
systemctl list-units --type=service --state=running
```

PIDを取得する
```shell
systemctl show <service> -p MainPID
```

### ポート/待受確認

待ち受けポートを確認する
```shell
ss -lntp
```

80番の待ち受けを確認する
```shell
ss -lntp | grep :80
```

443番の待ち受けを確認する
```shell
ss -lntp | grep :443
```

特定ポートを掴んでいるプロセスを確認する
```shell
lsof -i :3000
```

### ヘルスチェック（ローカルループバック）

nginx/アプリの応答確認（ヘッダーのみ）
```shell
curl -I http://127.0.0.1/
```

ヘルスエンドポイントを確認する（例）
```shell
curl -sS http://127.0.0.1/health | head
```

ステータスコードと応答時間を確認する
```shell
curl -sS -o /dev/null -w '%{http_code} %{time_total}\n' http://127.0.0.1/
```

---

## 本番: セキュリティ基本（更新・FW・SSH・権限）

### OS/更新

OS情報を確認する
```shell
lsb_release -a
```

カーネル情報を確認する
```shell
uname -a
```

更新を確認する（アップグレード一覧）
```shell
apt update
```

```shell
apt list --upgradable
```

パッケージのインストール候補/優先度を見る
```shell
apt-cache policy <pkg>
```

### UFW（ファイアウォール）

UFWの状態を詳細表示する
```shell
ufw status verbose
```

アプリプロファイル一覧を見る
```shell
ufw app list
```

### SSH/認証

22番ポートの待受を確認する
```shell
ss -lntp | grep :22
```

sshdの有効設定を確認する（実際の適用結果）
```shell
sshd -T | head
```

設定ファイルを確認する
```shell
cat /etc/ssh/sshd_config
```

### ユーザー/権限

ユーザーID/グループを確認する
```shell
id
```

所属グループを確認する
```shell
groups
```

ユーザー一覧を見る
```shell
getent passwd
```

グループ一覧を見る
```shell
getent group
```

sudo可能な範囲を確認する
```shell
sudo -l
```

sudoers本体を確認する（慎重に）
```shell
sudo cat /etc/sudoers
```

sudoers.dを確認する
```shell
sudo ls -la /etc/sudoers.d
```

---

## 本番: nginx よく使うコマンド

### 設定テスト/確認

設定をテストする（必須）
```shell
sudo nginx -t
```

読み込まれた設定全体を表示する（デバッグ向け）
```shell
sudo nginx -T | less
```

### 起動/停止/リロード

状態を確認する
```shell
sudo systemctl status nginx
```

設定を反映（切断を減らすリロード）
```shell
sudo systemctl reload nginx
```

再起動する
```shell
sudo systemctl restart nginx
```

停止する
```shell
sudo systemctl stop nginx
```

起動する
```shell
sudo systemctl start nginx
```

### 設定ファイル配置（構成確認）

sites-available を確認する
```shell
ls -la /etc/nginx/sites-available
```

sites-enabled を確認する
```shell
ls -la /etc/nginx/sites-enabled
```

conf.d を確認する
```shell
ls -la /etc/nginx/conf.d
```

### nginxログ確認

アクセスログを確認する
```shell
sudo tail -n 200 /var/log/nginx/access.log
```

エラーログを確認する
```shell
sudo tail -n 200 /var/log/nginx/error.log
```

アクセスログを追従する
```shell
sudo tail -f /var/log/nginx/access.log
```

エラーログを追従する
```shell
sudo tail -f /var/log/nginx/error.log
```

### 設定から手がかりを探す

server_name を検索する
```shell
sudo grep -R "server_name" -n /etc/nginx
```

proxy_pass を検索する
```shell
sudo grep -R "proxy_pass" -n /etc/nginx
```

---

## 本番: vi / vim 定番（最小セット）

説明: ここは「vimの操作一覧」です（コマンドではなくキー操作）。必要最低限のみ記載します。

### 保存/終了
- `:w` 保存
- `:q` 終了
- `:wq` 保存して終了
- `:q!` 保存せず終了
- `ZZ` 保存して終了（ノーマルモード）

### 検索/移動
- `/pattern` 下方向検索
- `?pattern` 上方向検索
- `n` 次、`N` 前
- `gg` 先頭、`G` 末尾
- `:set nu` 行番号、`:set nonu` 解除

### 置換/編集
- `:%s/old/new/g` 全置換
- `:%s/old/new/gc` 確認付き置換
- `i` 挿入、`a` 追記、`o` 下に行追加
- `dd` 行削除、`yy` 行コピー、`p` 貼り付け
- `u` 戻す、`Ctrl+r` やり直し

---

## 本番: 侵入を疑う場合のチェック（初動）

### ログイン/認証

現在ログインしているユーザーを確認する
```shell
who
```

誰が何をしているか（CPU/ログイン/プロセス概要）
```shell
w
```

ログイン履歴を確認する（直近50件）
```shell
last -a | head -n 50
```

ユーザーごとの最終ログインを確認する
```shell
lastlog | head
```

失敗したSSHログインを確認する
```shell
sudo grep -n "Failed password" /var/log/auth.log | tail -n 50
```

成功したSSHログインを確認する
```shell
sudo grep -n "Accepted" /var/log/auth.log | tail -n 50
```

### ユーザー/鍵/権限の痕跡

ユーザー一覧を確認する
```shell
getent passwd
```

home配下を確認する
```shell
sudo ls -la /home
```

authorized_keys を探して権限も表示する
```shell
sudo find /home -maxdepth 2 -name authorized_keys -print -exec ls -la {} \;
```

sudoers.d を確認する
```shell
sudo ls -la /etc/sudoers.d
```

### 不審プロセス/待受/通信

プロセスツリーを確認する
```shell
ps auxf
```

待受ポートを確認する
```shell
ss -lntp
```

接続状況の一部を確認する
```shell
ss -antp | head
```

ESTABLISHEDなTCP接続を確認する（外向き含む）
```shell
sudo lsof -nP -iTCP -sTCP:ESTABLISHED | head
```

### 永続化（cron / systemd timers / enabled services）

ユーザーcronを確認する
```shell
crontab -l
```

rootのcronを確認する
```shell
sudo crontab -l
```

cronディレクトリを確認する
```shell
sudo ls -la /etc/cron.*
```

systemd timerを一覧する
```shell
sudo systemctl list-timers --all
```

有効化されたユニットファイルを一覧する
```shell
sudo systemctl list-unit-files --state=enabled
```

### 最近変更されたファイル（例）

/etc配下で最近変更されたファイルを探す（例: 7日以内）
```shell
sudo find /etc -type f -mtime -7 -print
```

/usr/local/bin 配下を確認する（例: 30日以内）
```shell
sudo find /usr/local/bin -type f -mtime -30 -print
```

アプリ配置ディレクトリを確認する（例: 7日以内）
```shell
sudo find /var/www -type f -mtime -7 -print | head
```

---

## 本番: 各種ログ出力（Ubuntu）

### systemd / journalctl

直近のエラーを含めて追う（原因切り分け）
```shell
journalctl -xe
```

nginxのログを直近1時間で確認する
```shell
journalctl -u nginx --since "1 hour ago"
```

特定サービスのログを追従する
```shell
journalctl -u <service> -f
```

今日のログをまとめて見る
```shell
journalctl --since "today"
```

### ファイルログ（代表例）

syslog を確認する
```shell
sudo tail -n 200 /var/log/syslog
```

認証ログを確認する
```shell
sudo tail -n 200 /var/log/auth.log
```

カーネルログを確認する
```shell
sudo tail -n 200 /var/log/kern.log
```

カーネルリングバッファを人間可読で確認する
```shell
dmesg -T | tail -n 100
```

### 追従（リアルタイム）

syslogを追従する
```shell
sudo tail -f /var/log/syslog
```

auth.logを追従する
```shell
sudo tail -f /var/log/auth.log
```

---

## 本番: Next.js（運用形態別）便利コマンド

### systemdでNext.js（node）をサービス運用している場合

サービス状態を確認する
```shell
systemctl status <nextjs-service>
```

直近ログを確認する
```shell
journalctl -u <nextjs-service> --since "2 hours ago"
```

ログを追従する
```shell
journalctl -u <nextjs-service> -f
```

再起動する
```shell
sudo systemctl restart <nextjs-service>
```

### PM2で運用している場合

稼働状況を確認する
```shell
pm2 status
```

ログを確認する（直近）
```shell
pm2 logs --lines 200
```

プロセス詳細を見る
```shell
pm2 show <name>
```

再起動する
```shell
pm2 restart <name>
```

### Dockerで運用している場合

コンテナ一覧を確認する
```shell
docker ps
```

ログを追従する（直近200行）
```shell
docker logs --tail 200 -f <container>
```

リソース使用量を見る
```shell
docker stats
```

コンテナ設定を確認する
```shell
docker inspect <container> | less
```

コンテナ内に入る
```shell
docker exec -it <container> sh
```

### 本番切り分けで役立つ共通コマンド

環境変数を一覧する（差分確認に便利）
```shell
printenv | sort | less
```

リソース制限を確認する
```shell
ulimit -a
```

nginx経由の実際の挙動をヘッダー込みで確認する
```shell
curl -sS -D- -o /dev/null https://your-domain.example
```

（Git管理の場合）直近のデプロイ履歴を確認する
```shell
git log -n 20 --oneline
```

---
