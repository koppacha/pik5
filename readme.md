# 新ピクチャレ大会 Pikmin Series Leaderboards
**Since: 2006/09/01**  
**author:@koppachappy**

## このプロジェクトについて
* 任天堂よりリリースされたゲームシリーズ『ピクミン』のスコアアタックランキングどcけ投稿サイトです。

## このソースコードについて
当プロジェクトはMITライセンスのオープンソースであり、権利表記を削除しなければソースコードの改変や二次配布は自由にできますが、
当プロジェクトと同じピクミン関連のコンテンツとして公開することは競合やユーザーの分散による参加人数減につながるため、ご遠慮ください。

## 開発環境
* OS：macOS https://www.apple.com/jp/macos/ventura/
* Infra：Docker Desktop https://www.docker.com/products/docker-desktop/
* IDE：Intellij IDEA https://www.jetbrains.com/ja-jp/idea/
* API：Postman https://www.postman.com/
* Browser：Google Chrome https://www.google.com/intl/ja_jp/chrome/

＊原則として最新版を利用  
＊Windows環境はDockerの動作が重いので推奨しませんが、もし開発する場合はWSL2(Ubuntu)をインストールし、
その中にデータを入れるとある程度軽快に動きます。  
＊現在、lima VMでクロスプラットフォームでも軽快に動く環境を模索中……

## 動作確認環境
* PC/OS：Windows 11 (Parallel Desktop for M1 Mac)
* PC/Browser：Google Chrome
* SP/OS：iPhone
* SP/Browser：Safari

＊原則としてOS、ブラウザともに最新版を利用  
＊上記以外（タブレット全般、Android端末、その他のブラウザ）は原則サポート外となります。  
＊上記に加えて開発環境でも動作確認しています。

## 主な使用技術
* PHP：https://www.php.net/manual/ja/index.php (backend)
  * Laravel：https://readouble.com/laravel/ (backend framework)
* JavaScript：https://ja.javascript.info/ (frontend)
  * React：https://ja.reactjs.org/docs/getting-started.html (frontend framework)
    * Next.js：https://nextjs.org/docs/getting-started (React framework)
    * Material UI：https://mui.com/material-ui/getting-started/overview/ (UI framework)
* Docker：https://docs.docker.jp/index.html (Infra)

＊インフラ基盤は基本的にUbuntuかAlpine Linuxを使用。

## その他プラグイン
* Font Awesome：https://fontawesome.com/ (Icons)
* Styled-Components：https://styled-components.com/ (CSS in JS)
* Yup：https://github.com/jquense/yup (frontend Validation)

## 環境構築手順
```shell
# ソースコードをダウンロード
$ git clone git@github.com:koppacha/pik5.git
$ cd pik5

# 定数ファイルをコピー
$ cp sanple.env .env

# 仮想環境コンテナを構築（初回は時間がかかります）
$ docker compose up -d

# 以下実行前にフロントサーバー用に新しいターミナルを起動
$ docker compose exec next bash
$ yarn install
$ yarn dev # 終了するときはCtrl+C、権限エラーで動かないときは yarn install --check-files を試す

# 以下実行前にバックエンドサーバー用に新しいターミナルを起動
$ docker compose exec laravel bash
$ composer install
$ php artisan migrate:fresh
$ php artisan db:seed
$ php artisan serve --host 0.0.0.0 # 終了するときはCtrl+C

# 開発を終了する際は以下でコンテナを廃棄する
$ docker compose down
```

## 初回プッシュ前の準備
```shell
# ~/.sshフォルダに移動し秘密鍵を作る
$ cd ~/.ssh
$ ssh-keygen -t rsa # Enter 3回押す

# 以下のコマンドで公開鍵を表示し、コピーしてGithubに登録する
$ cat id_rsa.pub

# プロジェクトフォルダに戻って以下のコマンドで接続確認
$ ssh -T git@github.com

# HTTPSでクローンしていた場合はリモートURLを修正する
$ git remote set-url origin git@github.com:koppacha/pik5.git

# 本プロジェクトに使う名前とメールアドレスを設定する
$ git config user.name "(ユーザー名)"
$ git config user.email "(公開しても構わないメールアドレス)"
```

## 開発環境のURL一覧
* フロントエンド画面 http://localhost:3005
* バックエンド（API） http://localhost:8000

## バージョン管理のルール
```shell
# 作業が終わったら
$ git checkout -b your_branch # your_branchはあなたと判別できる任意のブランチ名
$ git add .
$ git commit -m "コメント" # コメントは作業内容
$ git push your_branch

# push後、https://github.com/koppacha/pik5/pulls からプルリクエストを投げてください

# 作業を再開するためにマスターブランチの内容を反映する
$ git fetch
$ git checkout master
$ git marge your_branch
$ git checkout your_branch

# 他の人があなたのブランチを編集した場合、その差分を取り込む
$ git fetch
$ git pull origin your_branch
```

## 編集時のルール
- CSS-in-JSをインラインで使う場合はstyle propを使う。（＊sxはGridコンポーネントの属性のひとつ「xs」と似ていて紛らわしいため）
```jsx
<Grid style={{width:"100%"}} xs={12}> {/* ←これはOK */}
<Grid sx={{width:"100%"}} xs={12}> {/* ←これはダメ */}
```

- フロントサイドレンダリングから直接APIを叩くのはNG。面倒でもNext.jsのAPIサーバーを経由する
- APIサーバーはNode.jsで記述する（import記法などは使えない）
```js
fetch('http://localhost/api/request') // ←これはダメ
fetch('/api/request') // ←これはOK。ただし経由APIで加工が必要な場合がある
```

## AWS Cloud9で動かす際のメモ
```shell
# docker composeが入っていないので下記コマンドで入れる
$ DOCKER_CONFIG=${DOCKER_CONFIG:-$HOME/.docker}
$ mkdir -p $DOCKER_CONFIG/cli-plugins
$ curl -SL https://github.com/docker/compose/releases/download/v2.16.0/docker-compose-linux-x86_64 -o $DOCKER_CONFIG/cli-plugins/docker-compose
$ chmod +x $DOCKER_CONFIG/cli-plugins/docker-compose

# デフォルト設定だとyarn installで落ちるのでボリュームを拡張する
# 　・インスタンス一覧→インスタンスIDをクリック→ボリュームタブ
# 　・ボリュームIDをクリック→ボリュームを選択して「アクション」タブ
# 　・ボリュームの変更をクリック→最低でも15GiB以上に設定する
# 下記コマンドでボリューム名を確認
$ df -h

# ボリュームへの割り当てを実行
$ sudo growpart /dev/nvme0n1 1 #nvme0n1はボリューム名の例
$ sudo xfs_growfs -d /

# プレビューにはサードパーティーCookie（サイト越えトラッキング）を許可する必要があります
```

## 基盤・ネットワーク関連のメモ
```shell
# 初期セットアップ (Ubuntu)
# まずはパッケージの更新
$ sudo apt update
$ sudo apt upgrade

# root以外のユーザーを作ってsudo権限を付与
$ adduser koppacha
$ gpasswf -a koppacha sudo # TODO:rootグループでいいかも（sudo入れるの面倒）

# sudoグループはsudo実行時にいちいちパスワードを聞かれないようにする
$ sudo visudo
$ %sudo ALL=(ALL:ALL) NOPASSWD: ALL

# ②SSH設定のバックアップを作成
$ sudo cp -p /etc/ssh/sshd_config{,.backup}

# ③②が完了したら次の項目をチェックして変更する
# Port →(22以外のユニークなポート番号)
# PermitRootLogin → no に変更

# 変更が終わったら以下を実行
$ sudo systemctl restart sshd

# 必要なアプリを入れる
$ sudo apt install vim git nginx certbot python3-certbot-nginx
$ sudo mkdir -p /etc/apt/keyrings
$ curl -fsSL https://download.docker.com/linux/ubuntu/gpg \
  | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
$ echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
  https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" \
  | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
$ sudo apt install docker-ce docker-ce-cli

# ドメインのDNSを設定
# a pik5.net. (VPSサーバーのIPアドレス）

# 使うポートを開ける
sudo ufw allow 80
sudo ufw allow 443
sudo ufw allow 3005 # ←フロントエンドのポート

# ネットワーク設定の実体ファイルを編集
vi /etc/nginx/sites-available/pik5.conf

# とりあえず以下のようになっていればOK
# server {
#        server_name pik5.net;
#        location / {
#                   proxy_pass http://localhost:3005;
#        }
# }

# sites-enabledにシンボリックリンクを貼る
sudo ln -s /etc/nginx/sites-available/pik5.conf /etc/nginx/sites-enabled/

# 証明書（Let's Crypto）のインストール
sudo certbot --nginx -d pik5.net
sudo cartbot renew --dry-run
```

## 備忘録
```shell
# limaでdocker daemonを変更したあと、Docker Desktopに戻したい場合は以下のコマンド
$ export DOCKER_HOST=unix:///var/run/docker.sock

# Windows (WSL) では、システムが作成したファイルはrootが権限を持ち編集できない。
# これを解決するためには該当するコンテナ内部から以下コマンドで所有権を変更する
$ ls -l # まずは所有権がrootにあることを確認しよう
$ chown -R 1000:1000 /Folder # Folderは対象フォルダの相対パス、1000は所有者名（nextの場合はnode）

# Windows環境でVMが異常にメモリを食っている場合は以下を実行でキャッシュを破棄
$ sudo sh -c "/usr/bin/echo 3 > /proc/sys/vm/drop_caches"
```

## バージョン履歴
### ver.1.00〜2.78（2007/04/29〜2023/07/20）
* ver.1：ピクミン３同盟内コンテンツ時代（2007/04/29〜2015/08/31）
* ver.2：ピクミンシリーズチャレンジモード大会（2015/09/01〜2023/07/20）  
詳しくは　https://github.com/koppacha/pik4 を参照

### ver.3.00 (2023/07/21)
* ゼロベースから作り直しリニューアルオープン
* ピクミン4に対応
* 特殊ランキング「ピクミン1全回収タイムアタック」を追加
* ピクミンキーワードを復活し（旧「新・ピクミンキーワード」も統合）、Markdownに対応
* 各年末時点のランキングを遡って閲覧できる集計年フィルターを追加
* 操作方法別集計に完全対応し、同じステージも操作方法ごとに自己ベストを記録できるようにした
* Speedrun.com APIに対応

### LICENCE
This project is compliant with the MIT License.
Please refer to the "./licence.txt" for license information.
Copyright (c) 2006 - 2023 koppacha