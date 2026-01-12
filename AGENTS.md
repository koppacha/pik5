# リポジトリ運用ガイドライン

## 全般
- 回答は日本語で簡潔かつ丁寧に記述してください。

## プロジェクト構成・モジュール構成
- next/ は Next.js フロントエンドを格納します（React、MUI、styled-components、Prisma クライアント利用など）。
- laravel/ は PHP/Laravel の API バックエンドです（コントローラ、モデル、ルーティング、マイグレーションなど）。
- docker-compose.yml は next / laravel / mysql / redis のローカルサービスを定義します。
- mysql/ と redis/ はローカルのデータボリュームです。log/mysql/ は DB ダンプとログを保存します。
- wiki/ と lab/ と sandbox/ には実験用コンテンツやドキュメントが入っています。変更対象がこれらに関係する場合を除き、編集は避けてください。

## ビルド・テスト・開発コマンド
- `cp sample.env .env` で、Docker サービスが利用するローカル環境設定を作成します。
- `docker compose up -d` で、フルスタック（Next.js / Laravel / MySQL / Redis）を起動します。
- `docker compose exec next bash` の後に `yarn dev` を実行すると、フロントエンドが http://localhost:3005 で起動します。
- `docker compose exec laravel bash` の後に `php artisan serve --host 0.0.0.0` を実行すると、API が http://localhost:8000 で起動します。
- `docker compose down` で、コンテナを停止して削除します。

## コーディングスタイル・命名規則
- JavaScriptのコードに文末のセミコロンはつけないでください。
- フロントエンドは CSS-in-JS を利用します。インラインスタイルを使う場合は、Grid の xs と混同しないよう、MUI の sx よりも style prop を優先してください。
- 片方の分岐が使われない三項演算子は避け、論理演算子（`&&`, `||`, `??`）を使用してください。
- 各モジュールの既存の命名に合わせてください（React コンポーネントは PascalCase、変数は camelCase）。
- フォーマット系ツール：フロントエンドは next lint、バックエンドは導入済みであれば ./vendor/bin/pint を利用できます。

## テストガイドライン
- バックエンドのテストは laravel/tests/ にあり、laravel コンテナ内で `php artisan test` または vendor/bin/phpunit を実行します。
- 典型的な手順は `docker compose exec laravel bash` の後に `php artisan test` です（対象を絞る場合は `--filter=ClassName` を使います）。
- テストがシード済みデータに依存する場合、実行前に `php artisan migrate:fresh` と該当シーダーでリセットしてください。
- フロントエンドは scripts に専用のテストランナーがありません。next/ 内で `yarn lint` を実行し、ブラウザでの手動スモークチェックに依存してください。
- DB 関連のテストは分離し、冪等性（何度実行しても同じ結果になること）を保ってください。既存のローカルボリュームに依存しないようにしてください。

## コミット・プルリクエストのガイドライン
- Git 履歴ではコミットメッセージとして ver.X.XX <short description>（日本語であることも多い）が使われています。この形式に合わせるか、短く要点が伝わる要約を付けてください。
- 機能ブランチを作成し（`git checkout -b your_branch`）、GitHub で PR を作成してください。
- PR にはユーザーが目にする変更点を説明し、UI 更新には関連スクリーンショットを添え、実行した DB マイグレーションやシードがあれば明記してください。

## 設定に関するヒント
- ローカル DB データをリセットする場合は、Laravel のシーダー（例：`php artisan db:seed --class=StageCsvSeeder`）を優先してください。
- MySQL のデータを truncate する必要がある場合は、MySQL コンテナ内で実行してください（`truncate table ...`）。