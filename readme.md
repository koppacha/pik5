# 新ピクチャレ大会
**Since: 2007/04/29**  
**author:@koppachappy**

## このプロジェクトについて
* 「ピクミンシリーズチャレンジモード大会（ver.2）」のフルリプレイスプロジェクトです。 2023年夏公開予定です。公開後に旧ピクチャレ大会は閉鎖します。

## 開発に参加したいという方へ
まずはTwitterかDiscordで管理人へ気軽にお問い合わせください。
下記の環境構築を試してみていただき、新規ブランチで開発していただく分にはなんの制限もありません。
devブランチへマージする際にはプルリクエストを投げておいてください。

## 環境構築手順
```shell
# ソースコードをダウンロード
$ git clone https://github.com/koppacha/pik5.git
$ cd pik5

# 仮想環境コンテナを構築（初回は時間がかかります）
$ docker compose up -d

# 定数ファイルをコピー
$ cp sanple.env .env

# 以下実行前にフロントサーバー用に新しいターミナルを起動
$ docker compose exec nuxt bash
$ npm install
$ npm run dev # 終了するときはCtrl+C

# 以下実行前にバックエンドサーバー用に新しいターミナルを起動
$ docker compose exec laravel bash
$ composer install
$ php artisan serve --host 0.0.0.0 # 終了するときはCtrl+C

# 開発を終了する際は以下でコンテナを廃棄する
$ docker compose down
```
上記実行後、 http://localhost:3000 にアクセス

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
