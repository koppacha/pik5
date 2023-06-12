# 新ピクチャレ大会 Pikmin Series Leaderboards
**Since: 2006/09/01**  
**author:@koppachappy**

## このプロジェクトについて
* 「ピクミンシリーズチャレンジモード大会」のフルリプレイスプロジェクトです。
2023年07月公開予定です。

## このソースコードについて
当プロジェクトはMITライセンスのオープンソースであり、権利表記を削除しなければソースコードの改変や二次配布は自由にできますが、
当プロジェクトと同じピクミン関連のコンテンツとして公開することは競合やユーザーの分散による参加人数減につながるため、ご遠慮ください。

## おすすめ開発環境
* OS：macOS https://www.apple.com/jp/macos/ventura/
* Infra：Docker Desktop https://www.docker.com/products/docker-desktop/
* IDE：Intellij IDEA https://www.jetbrains.com/ja-jp/idea/
* API：Postman https://www.postman.com/
* Browser：Google Chrome https://www.google.com/intl/ja_jp/chrome/

＊原則として最新版を利用  
＊Windows環境はDockerの動作が重いので推奨しませんが、もし開発する場合はWSL2(Ubuntu)をインストールし、
その中にデータを入れるとある程度軽快に動きます。  
＊現在、lima VMでクロスプラットフォームでも軽快に動く環境を模索中……

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
* フロントエンド画面 http://localhost:8080
* バックエンド（API） http://localhost:8000
* phpmyadmin（DB） http://localhost:6000
* mail-hog http://localhost:8045

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
- CSS-in-JSをインラインで使う場合はstyle propを使う。（＊sxはGridコンポーネントの「xs」と似ていて紛らわしいため）
```jsx
<Grid style={{width:"100%"}} xs={12}> ←これはOK
<Grid sx={{width:"100%"}} xs={12}> ←これはダメ
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

## その他のメモ
```shell
# limaでdocker daemonを変更したあと、Docker Desktopに戻したい場合は以下のコマンド
$ export DOCKER_HOST=unix:///var/run/docker.sock
```

## バージョン履歴
### ver.1.00〜2.78（2007/04/29〜2023/XX/XX）
* ver.1：ピクミン３同盟内コンテンツ時代（2007/04/29〜2015/08/31）
* ver.2：ピクミンシリーズチャレンジモード大会（2015/09/01〜）  
詳しくは　https://github.com/koppacha/pik4 を参照

### ver.3.00 (2023/01/01)
* 多すぎて省略

### LICENCE
This project is compliant with the MIT License.
Please refer to the "./licence.txt" for license information.
Copyright (c) 2006 - 2023 koppacha