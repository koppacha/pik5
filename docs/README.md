# 開発ドキュメントの入口

最終整理日：2026-10-15。ローカル作業ツリーの実装・設定・テストと照合。本番への接続・変更は行っていません。

## 読む範囲

- 毎回把握する方針：[AI開発の共通方針](codex-summary/codex-working-rules.md)、[構成と運用](codex-summary/repository-operations.md)、[テスト方針](codex-summary/testing-and-verification.md)。上位・対象ディレクトリのAGENTS.mdも確認する。
- 機能作業：下表の該当サマリーから実装・詳細仕様へ進む。サマリー全件や作業ログを一括でコンテキストに入れない。
- 履歴調査：必要な作業ログ・リリース記録だけを参照する。過去の実測値・未反映状態・一時データを現状へ適用しない。

## サマリー索引

| 対象 | 入口 |
| --- | --- |
| UI・Pages Router・表示規約 | [frontend-next](codex-summary/frontend-next.md) |
| API・集計・scheduler・Seeder | [backend-laravel](codex-summary/backend-laravel.md) |
| DB分離・Prisma・migration | [data-and-prisma](codex-summary/data-and-prisma.md) |
| 認証・認可・proxy・信頼境界 | [auth-security-proxy](codex-summary/auth-security-proxy.md) |
| 配備・設定・バックアップ | [deployment-and-environment](codex-summary/deployment-and-environment.md) |
| SSR・通信・キャッシュ・描画 | [caching-and-performance](codex-summary/caching-and-performance.md) |
| 記録・スコア・証拠 | [records-and-scoring](codex-summary/records-and-scoring.md) |
| イベント成績・アリーナ・スイス式 | [events-and-rankings](codex-summary/events-and-rankings.md) |
| ルール応募 | [limited-ideas](codex-summary/limited-ideas.md) |
| ルール48・拡張コード・管理 | [security-and-rule48-planning](codex-summary/security-and-rule48-planning.md) |
| お宝シミュレーター | [treasure-simulator](codex-summary/treasure-simulator.md) |
| キーワード記事・参照元方針 | [keywords-editorial](codex-summary/keywords-editorial.md) |
| 大会のルール・整合性 | [tricks-rules](codex-summary/tricks-rules.md)、[tricks-rule-consistency](codex-summary/tricks-rule-consistency.md) |
| 大会のUI・カード・リプレイ | [tricks-ui](codex-summary/tricks-ui.md)、[tricks-deck-schema](codex-summary/tricks-deck-schema.md)、[tricks-replay](codex-summary/tricks-replay.md) |
| 大会APIの回帰観点 | [tricks-release-audit](codex-summary/tricks-release-audit.md) |
| 研究・行動モデル・第20回案 | [tricks-tournament-analysis](codex-summary/tricks-tournament-analysis.md)、[tricks-personalities](codex-summary/tricks-personalities.md)、[tricks-reward-proposals](codex-summary/tricks-reward-proposals.md) |

## 詳細・運用・履歴

| 種別 | 資料と扱い |
| --- | --- |
| 現行の操作手順 | [commands.md](commands.md)、[DB復旧](database-recovery.md)、[投稿API確認](testing-post-api.md) |
| リロード時の429・認証表示 | [調査とNginx反映手順](top-reload-429.md)。本番観測とローカル修正・未反映状態を区別 |
| ローカル追加実装 | [ルール48・セキュリティ](security-and-rule48-implementation.md)。作業ツリーに存在し、本番設定・反映は別工程 |
| 認定記録・世界記録報告 | [投稿・保存・ボーダーの契約](dandori-certified-world-records.md)。48の認定マーカー、31/32/33/34/36/48の世界記録テーブルと報告フォーム |
| セキュリティ改修方針 | [Argon2id移行・KMS導入条件](security-argon2id-kms-plan.md)。Argon2idは実施方針、KMSはCodexによるAWS操作が可能な場合に導入。別セッションで実装 |
| 年別記録ページ | [仕様・キャッシュ更新・検証](yearly-record-page.md)、[調査と計画](yearly-record-page-plan.md) |
| 機能の詳細正本 | [トリック規則](../next/pages/limited/tricks/docs/tricks-rules.md)、[システム](../next/pages/limited/tricks/docs/tricks-system.md)、[シミュレーター](../next/pages/limited/tricks/docs/tricks-simulation.md)、[第20回案](../next/pages/limited/tricks/docs/tricks-tournament-20-plan.md) |
| 調査資料・企画 | [参照元ライセンス](keywords-source-licenses.md)、[アリーナ企画](idea/event-arena.md)。記載日と未確定事項に注意 |
| 過去の移行・リリース | [Prisma7移行](codex-260412-prisma7-upgrade.md)、[2026-09-12](release-2026-09-12.md)。現在の作業手順としてそのまま再実行しない |
| Git履歴点検 | [2026-10-24の履歴整理](history-publication-audit-2026-10-24.md)。ローカル4ブランチの処理、伏字の置換一覧、リモート・復旧用履歴の残存範囲 |
| 公開前点検 | [2026-10-24の文書・画像点検](publication-audit-2026-10-24.md)。除外・匿名化・過去履歴の注意点 |
| 未コミット差分 | [2026-10-24の機能別一覧・コミット候補](uncommitted-changes-2026-10-24.md)。共通ファイルの混在、migration、検証済み範囲を確認 |
| 今回の照合と検証 | [2026-10-15の整理記録](documentation-audit-2026-10-15.md)。訂正根拠と未検証範囲 |
| 整理前資料 | [アーカイブ案内](archive/README.md)。訂正前の記載を含み、通常参照しない |
| 作業ログ | `codex-logs/`：原則保存するtranscript。通常のコンテキストには入れず、必要な履歴調査で参照可能 |
| 開発統計 | `stats.html`：生成物。更新依頼時だけ `scripts/update-stats.mjs` で再集計 |
| 予約領域 | `sandbox.md`：空の予約ファイル。開発方針として参照不要 |

## 更新ルール

- サマリーは継続すべき判断材料を現在形で書き換える。単発の作業結果や検証件数は日付付き記録へ置き、重要な契約だけ抽出する。
- 方針、実装済みの挙動、未確定案、環境の観測結果を区別する。実装と方針が違う場合は差異を明記し、推測でどちらかを確定しない。
- 「ローカル実装」「テスト成功」「コミット済み」「本番反映済み」は別状態。本番の現状は必要な作業時に確認する。
- 実装・schema・テストが変わったら該当サマリーと詳細正本を同じ作業で更新する。新しいカテゴリを追加したらこの索引へ登録する。
- 作業ログ原文は書き換えない。秘密情報は記録の原文保持より優先して除外し、除外した種類だけ示す。
