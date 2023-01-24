# 新ピクチャレ大会
**Since: 2007/04/29**  
**author:@koppachappy**

## このプロジェクトについて
* 「ピクミンシリーズチャレンジモード大会（ver.2）」のフルリプレイスプロジェクトです。 2023年夏公開予定です。公開後に旧ピクチャレ大会は閉鎖します。

## 開発に参加したいという方へ
まずはTwitterかDiscordで管理人へ気軽にお問い合わせください。
下記の環境構築を試してみていただき、新規ブランチで開発していただく分にはなんの制限もありません。
masterブランチへのマージは管理者権限が必要です。その場合はプルリクエストを投げておいてください。
**他所でGitを使っている人は名前とメールアドレスの流出にご注意を！**

## おすすめ開発環境
* OS：macOS https://www.apple.com/jp/macos/ventura/
* Infra：Docker Desktop https://www.docker.com/products/docker-desktop/
* IDE：Intellij IDEA https://www.jetbrains.com/ja-jp/idea/
* API：Postman https://www.postman.com/
* Browser：Google Chrome https://www.google.com/intl/ja_jp/chrome/

＊原則として最新版を利用

## 開発コンセプト
Laravel（PHP）とNext.js（JavaScript、React）の疎結合でフロントエンドとバックエンドをそれぞれ独立させた開発を目指します。
当初はNuxt.js（Vue.js）を採用していましたが、
最新バージョンの仕様が揺れていることや英語圏を含むインターネット全体での知見不足からNext.jsに乗り換えました。  
開発にはPHPとJavaScriptの知識が必須になります。

## 各種マニュアル
* PHP：https://www.php.net/manual/ja/index.php
* Laravel：https://readouble.com/laravel/
* JavaScript：https://ja.javascript.info/
* React：https://ja.reactjs.org/docs/getting-started.html
* Next.js：https://nextjs.org/docs/getting-started
* Material UI：https://mui.com/material-ui/getting-started/overview/
* Docker：https://docs.docker.jp/index.html
* Git：https://tracpath.com/docs/

## 環境構築手順
```shell
# ソースコードをダウンロード
$ git clone https://github.com/koppacha/pik5.git
$ cd pik5

# 定数ファイルをコピー
$ cp sanple.env .env

# 仮想環境コンテナを構築（初回は時間がかかります）
$ docker compose up -d

# 以下実行前にフロントサーバー用に新しいターミナルを起動
$ docker compose exec next bash
$ yarn install
$ yarn dev # 終了するときはCtrl+C

# 以下実行前にバックエンドサーバー用に新しいターミナルを起動
$ docker compose exec laravel bash
$ composer install
$ php artisan migrate:fresh
$ php artisan db:seed
$ php artisan serve --host 0.0.0.0 # 終了するときはCtrl+C

# 開発を終了する際は以下でコンテナを廃棄する（再開するたびにコンテナ構築からやり直す）
$ docker compose down
```
上記実行後、 http://localhost:3000 にアクセス

## 開発環境のURL一覧
* フロントエンド画面 http://localhost:3000
* バックエンド（API） http://localhost:8000
* phpmyadmin（DB） http://localhost:6000
* mailhog http://localhost:8045

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

## バージョン履歴
### ver.1.00〜2.78（2007/04/29〜2023/XX/XX）
* ver.1：ピクミン３同盟内コンテンツ時代（2007/04/29〜2015/08/31）
* ver.2：ピクミンシリーズチャレンジモード大会（2015/09/01〜）  
詳しくは　https://github.com/koppacha/pik4 を参照

### ver.3.00pre (2022/09/13〜2022/12/31)
* ピクミン4正式発表を受けてプロジェクトの本格始動
* Docker環境構築
* フロントエンド開発環境構築（Nuxt.js）
* バックエンド開発環境構築（Laravel）
* 簡易CRUDシステムの構築とテスト
* DB基礎構築（MySQL）
* CSSフレームワーク導入（Quasar）

### ver.3.00 (2023/01/01)
* Gitリポジトリへの登録
