# 新ピクチャレ大会 the Pikmin Series Leaderboards
**Since: 2007/04/29**  
**author: @koppachappy**
---
## このプロジェクトについて
* 任天堂よりリリースされたゲームシリーズ『ピクミン』のスコアアタックランキング投稿サイトです。
* 本番環境：https://pik5.net
---
## このソースコードについて
* ソースコードは公開していますが、管理人が作成したすべてのファイルの著作権は管理人が保有します。 無断転載、二次利用はご遠慮ください。
ただし、当システムを利用してピクミン以外のランキングサイトを作りたい場合は特例として二次利用を許可する場合があります。
そのようなケースでの利用をご希望の場合は個別に管理人へご連絡ください。
---
## 開発環境
* OS：[macOS](https://www.apple.com/jp/macos)
* Infra：[Docker Desktop](https://www.docker.com/products/docker-desktop/)
* IDE：[Intellij IDEA](https://www.jetbrains.com/ja-jp/idea/)
* API：[Postman](https://www.postman.com/)
* Browser/DevTools：[Google Chrome](https://www.google.com/intl/ja_jp/chrome/)

>Windowsで動かす場合、WSLに割り当てるメモリが最低3GB必要です。
---
## 動作確認環境
* PC/OS：macOS、Windows
* PC/Browser：Google Chrome
* SP/OS：iPhone 12 Pro Max
* SP/Browser：Safari

>原則としてOS、ブラウザともに最新版を利用（WindowsのみWindows 10を使用）  
>上記以外（タブレット全般、Android端末、その他のブラウザ）は原則サポート外となります。  
---
## 主な使用技術
* [HTML](https://developer.mozilla.org/ja/docs/Web/HTML)（ページの構造化を担当）
* [CSS](https://developer.mozilla.org/ja/docs/Web/CSS)（見た目の装飾などを担当）
* [PHP](https://www.php.net/manual/ja/index.php) (バックエンド用のプログラミング言語。サーバーでの情報処理に使う)
  * [Laravel](https://readouble.com/laravel/) (PHPのフレームワークで、主にDBのリクエストや管理、操作などを担当)
* [JavaScript](https://ja.javascript.info/) (フロントエンド用のプログラミング言語。webブラウザ上での処理に使う)
  * [React](https://ja.reactjs.org/docs/getting-started.html) (JSのフレームワークで、主に画面表示の制御を担当)
    * [Next.js](https://nextjs.org/docs/getting-started) (サーバーサイド処理ができるようになるReactのフレームワーク)
    * [Material UI](https://mui.com/material-ui/getting-started/overview/) (ReactのCSSフレームワークで、デザインの統一感を出すために利用)
  * [Prisma](https://www.prisma.io/) (Next-Auth.jsとデータベースのやり取りを仲介〈ORM〉する技術)
* [Docker](https://docs.docker.jp/index.html) (ひとつのOSに仮想コンテナを複数作成するための基盤技術）
* [nginx](https://www.nginx.co.jp/) (ネットワーク基盤を制御）

>基盤OSは基本的にUbuntuかAlpine Linuxを使用。
---
## 主な利用プラグイン
* [Font Awesome](https://fontawesome.com/) (高クオリティなSVGアイコンが使い放題になる便利なプラグイン）
* [Styled-Components](https://styled-components.com/) (コンポーネントごとにCSSを適用できるようになる便利なプラグイン)
* [Yup](https://github.com/jquense/yup) (フォームのバリデーションチェックを楽にする便利なプラグイン)
* [Fuse.js](https://www.fusejs.io/) (高速検索を超簡単に実装できる便利なプラグイン)
* [Next-Auth.js (Auth.js)](https://authjs.dev/) (厄介な認証をまとめて処理できる便利なプラグイン)
---
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
---
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
---
## 開発環境のURL一覧
* フロントエンド画面 http://localhost:3005
* バックエンド（API） http://localhost:8000
---
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
---
## 編集時のルール・メモ
CSS-in-JSをインラインで使う場合はstyle propを使う。（＊sxはGridコンポーネントの属性のひとつ「xs」と似ていて紛らわしいため）
```jsx
<Grid style={{width:"100%"}} xs={12}> {/* ←これはOK */}
<Grid sx={{width:"100%"}} xs={12}> {/* ←これはダメ */}
```

三項目のいずれかが不要な場合は三項演算子を使わず、比較演算子を使う。
```js
// 例：pelletがfalseでないならpikminに特定のコンポーネントを代入したい場合
const pikmin = pellet ? <Oniyon/> : undefined // これはダメ

const pikmin = pellet && <Oniyon/> // 比較演算子&&は左辺がtrue相当なら右辺を返す
const pikmin = pellet || <Oniyon/> // 比較演算子||は左辺がfalse相当なら右辺を返す（PHPの?:に相当）

// 状況に応じてこっちも使おう
const pikmin = pellet ?? <Oniyon/> // Null合体演算子??は左辺がnullかundefinedなら右辺を返す
```

データベースを再作成する場合のコマンド
```shell
# MYSQLコンテナから直接テーブルを空にする場合
docker compose exec mysql bash # MySQLコンテナでログイン
truncate table stages;
```

```shell
# クラスを指定してSeederを再実行する場合
docker compose exec laravel bash
php artisan db:seed --class=StageCsvSeeder
```

---
## 基盤・ネットワーク関連のメモ
```shell
# 初期セットアップ (Ubuntu)
# まずはパッケージの更新
$ sudo apt update
$ sudo apt upgrade

# root以外のユーザーを作ってsudo権限を付与
$ adduser username
$ gpasswf -a username sudo # TODO:rootグループでいいかも（sudo入れるの面倒）

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
```

nginx設定ファイル（certbotが勝手に書き換えるので最小限で良い）
```text
server {
    listen 80;
    server_name pik5.net;

    location / {
        proxy_pass http://localhost:3005; // フロントエンドのポート
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

```shell
# sites-enabledにシンボリックリンクを貼る
sudo ln -s /etc/nginx/sites-available/pik5.conf /etc/nginx/sites-enabled/
sudo systemctl reload nginx

# 証明書（Let's Crypto）のインストール
sudo certbot --nginx -d pik5.net
sudo cartbot renew --dry-run

# 自動更新が有効になっているかチェック
sudo systemctl status certbot.timer
```
---
## 備忘録
```shell
# limaでdocker daemonを変更したあと、Docker Desktopに戻したい場合は以下のコマンド
$ export DOCKER_HOST=unix:///var/run/docker.sock

# Windows (WSL) では、システムが作成したファイルはrootが権限を持ち、rootである限り編集できない。
# これを解決するためには該当するコンテナ内部から以下コマンドで所有権を変更する
$ ls -l # まずは所有権がrootにあることを確認しよう
$ sudo chown -R user:user Folder/ # Folderは対象フォルダの相対パス、userは所有者名（nextの場合はnode）

# git pull実行時、上記の問題でパーミッションエラーが出ると差分が中途半端に取り込まれる。
# その場合、まず以下を実行して変更を巻き戻してから上記の解決法で所有者問題をクリアにしてから再pull
$ git clean -d -f .

# Windows環境でVMが異常にメモリを食っている場合は以下を実行でキャッシュを破棄
$ sudo sh -c "/usr/bin/echo 3 > /proc/sys/vm/drop_caches"

# なんらかのコマンドで no space left on device というエラーが出たらDockerをお掃除しよう
$ docker system prune -a --volumes

# やるたびに忘れているので記録データベースのまるごとバックアップ手順の備忘録
# ①本番環境でdumpする。dumpしたファイルはコンテナ外の`pik5/log/mysql`へ格納される
$ mysqldump --single-transaction -u root -p bowsprit records > /var/log/recordsYYMMDD.sql;

# ②開発環境でimportする前にデータを綺麗にする。
$ mysql> truncate records;

# ③開発環境へimport。import時はテーブル名の指定は必要ない
$ cd /var/log/
$ mysql -u root -p bowsprit < recordsYYMMDD.sql

```

---
## バージョン履歴
### ver.1.00〜2.78（2006/09/01〜2023/07/20）
* ver.1：ピクミン３同盟（2006/09/01〜2015/08/31）
  * ピクミンキーワードの掲載は2007/02/21
  * チャレンジモード大会の開催は2007/04/29
* ver.2：ピクミンシリーズチャレンジモード大会（2015/09/01〜2023/07/20）  
>過去の履歴についてはリポジトリ[pik4](https://github.com/koppacha/pik4)を参照

### ver.3.00 (2023/07/21)
* ゼロベースから作り直しリニューアルオープン
* 特殊ランキング「ピクミン1全回収タイムアタック」を追加
* ピクミンキーワードを復活し（旧「新・ピクミンキーワード」も統合）、Markdownに対応
* 各年末時点のランキングを遡って閲覧できる集計年フィルターを追加
* 操作方法別集計に完全対応し、同じステージも操作方法ごとに自己ベストを記録できるようにした
* Speedrun.com APIに対応

### ver.3.01 (2023/07/30)
* ピクミン4全28ステージに対応し、ピクミン4総合ランキングを新設
* タイムアタック系のスコア投稿に対応
* Redisキャッシュサーバーを導入
* 画像アップロード時にCompresser.jsを噛ますようにした
* 投稿後24時間以内の記録は投稿者にかぎり削除できるようにした
* モバイルメニューのデザイン改善

### ver.3.02 (2023/09/21)
* 移転前の期間限定、参加者企画、チャレンジ複合、その他全306ステージを追加
* レギュレーション確認ボタンを総合ランキングにも設置
* ヘッダーとステージリストは横スクロールできるようにした
* ピクミン４のタイムボーナス表記に対応
* 時間入力はtimeフォーマットを廃止して正規表現チェックの単純文字列入力に変更

### ver.3.03 (2023/10/08)
* 横断検索機能を追加
* センシティブなワードを含むコメントは自動削除するようにした
* ユーザー別ページに初投稿日と総投稿数を表示するようにした
* ロール機能を追加

### ver.3.04（2023/11/11）
* 期間限定ルール投稿フォームを追加
* 携帯版表示時、モバイルフッターから検索フォームを開けるようにした
* 新着順一覧でも順位とランクポイントを表示するようにした
* 総合ランキングのコメント欄に初代ピクチャレ大会風順位マーカーを追加
* イベントカレンダーを追加
* キーワードトップページは五十音順ではなくタグごとに表示するようにした
* ステージ一覧リンクは操作方法・ルール・集計年を継承するようにした
* ユーザー別ページに全操作方法クリアマーカーを追加

### ver.3.05（2023/12/16）
* 期間限定チーム対抗戦をリニューアルして追加
* ステージ別・カテゴリ別ルールはモーダルだけでなく常時表示するようにした
* パンくずリストのデザインを改善
* アイデア投稿フォーム周りの不具合を修正
* 新規キーワード作成時、アイデアを選択した場合にステージを指定できるようにした
* キーワードの「読み仮名」は入力されていなくても許容するようにした
* APIロード中に404エラーが表示される不具合の修正

### ver.3.06（2024/01/11）
* ユーザー別ランキングが正常表示されない不具合の修正
* StageListsコンポーネントを短時間で複数回クリックするとエラーを引き起こす不具合の修正
* レンダリング方式をSSRからISRへ移行
* ブラウザ機能でリロード時するとページデザインが崩れる不具合の修正
* 各テンプレートが年越しに対応していない不具合の修正
* 英語版表示時、500エラーが頻発する不具合の修正
* コンソール（操作方法）アイコンの暫定設置
* ランダムステージボタンを設置
* ネットワーク混雑時、検索インデックスJSONが正常に処理されない不具合の修正

### ver.3.07（2024/02/13）
* 記録削除権限フラグが正常動作していない不具合の修正
* ライトテーマのカラースキームを見直してリニューアルした
* ピクミン４のステージ名英訳を機械翻訳から正式名に置き換えた
* 特殊ランキングは記録コンポーネントとタイトルにルール名を付記するようにした
* ユーザースコア２者比較機能「ピクチャレ星取表」を追加

### ver.3.08（2024/03/24）
* 本編地下の投稿フォームを、入力情報に基づきスコアを自動算出するように機能改善
* 本編地下のルールは常時表示時のみ簡易版を表示するようにした
* ステージ別ページに制限時間、初期ピクミン、お宝価値合計を表示するようにした
* サイドストーリーで操作方法を表示できない不具合の修正
* 本番環境でのみ発生しているバックエンド処理の不具合を修正
* 総合ランキングで同点の場合は最終投稿日が古い順に表示するようにした
* ピクミン２のSwitch版、海外版におけるリージョン違いに対応した
* ピクミン２チャレンジモード全ステージ全滅RTAを追加

### ver.3.09（2024/07/15）
* イベントカレンダーとお知らせカラムを廃止し、トップメニューと縛りルール投稿はダッシュボードへ統合
* スマホメニューの各種不具合を修正
* ステージ情報などのヘッダー要素の縦幅を調整してスマホ表示時のUXを改善
* 週末ダンドリバトル記録専用ページの仮設置
* 各記録を左右スワイプでユーザーページ、ステージページへ飛べるようにした
* RTA系のランキングで新着順の順位が正しい値にならない不具合の修正
* ソロビンゴ、ソロバトルの総合ランキングの合計点算出が実態と合わない不具合の修正
* ユーザー別ページのクリアマーカーを廃止し、総合点情報を表示
* チャレンジ総合70.1万RTA、タイトル画面全滅RTA、本編1000匹RTAを追加
* ダンドリチャレンジ、ダンドリバトル、葉っぱ仙人の挑戦状にゲキカラモードを追加
* 権限がある場合、キーワードをID指定して新規作成できるようにした
* オンデマンドISR機能（更新ボタン押下か投稿タイミングでのみキャッシュ更新）を試験的に導入した
* 全総合のマーカーの大きさを４分の１に変更した

### LICENCE
Copyright (c) 2006 - 2024 koppacha (Twitter@koppachappy)