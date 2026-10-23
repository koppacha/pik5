# 認定記録・世界記録報告

2026-10-20にローカル実装。本番への反映は行っていない。

## 認定記録（ルール48）

通常の記録投稿・再編集フォームに、ルール48の場合だけ「認定記録」チェックを表示する。既存の`records.post_memo`内の独立したトークン`[pik5:dandori-certified:v1]`で識別し、カラムは追加しない。

- クライアントからは`certified=0|1`を送る。任意の`post_memo`は受け付けず、Laravel側でマーカーを組み立てる。
- 再編集時は既存の認定状態をフォームへ復元する。チェック解除でマーカーを除去し、編集履歴等の他のメモは保持する。旧クライアントが指定を省略した場合は元の認定状態を引き継ぐ。
- ルール48以外ではマーカーによる認定を成立させない。認定状態は順位・採点を分離するフィルターではなく、記録の属性として表示する。
- 公開レスポンスは`is_certified`の真偽値を返す。`post_memo`全文は返さない。Eloquentの選択列にメモを含めてもhiddenで非公開にし、Query Builderを使う年別ページでも真偽値へ変換してメモを除く。
- 共通`Record`で`fa-tag`の直前に`fa-certificate`を表示し、ツールチップは「認定記録」。一覧・詳細・新着等で同じ判定を使う。

入口：`RecordForm.js`、Next `/api/server/post`、Laravel `RecordController`、`RecordCertification`、`Record`モデル、`config/const.php`、`YearRecords`。

## 世界記録の報告と保存

対象はルール31・32・33・34・36・48。ステージ別ページの「記録投稿」の左に、同じスタイルの「世界記録報告」を置く。ログイン済み利用者はモーダルから次の項目を入力する。

| 項目 | 扱い |
| --- | --- |
| 投稿者名 | ログイン利用者名をdisabledでグレーアウトして表示。保存する主体は現在の認証DBのUserを再確認し、署名したログインIDに固定 |
| プラットフォーム | 301〜330・345〜350はWii U（3）/Nintendo Switch（4）を選択。331〜344およびルール48はSwitch固定でグレーアウト。ルール34にも同じ境界を適用 |
| 世界記録保持者名 | 必須文字列、前後空白除去、100文字以内 |
| 記録 | 1〜999999の整数。時間表示のステージは時:分:秒または分:秒で入力し、整数秒へ変換する。ピクミン3の経過時間は一般投稿と同じ残り時間＋基準点へ変換し、48は設定に従う秒数をそのまま保存 |
| 証拠画像 | 任意。一般投稿と同じCompressor設定で圧縮し、multipartで転送。JPEG・PNG・GIF・WebP、サーバー側でも画像検証、5MBまで |

`world_record_reports`へ追記する。列は`id`・`stage_id`（内部数値）・`rule`・`reporter_user_id`・`holder_name`・`score`・`img_url`・`platform`・`is_active`・`deleted_at`・`deleted_by`・timestamps。通常の`records`、自己ベスト、投稿数、総合成績へは追加しない。新規報告は`is_active=true`として保存し、事前承認画面は設けていない。

有効な報告のうち、同一ステージ・ルール・プラットフォームで最良値を採用する。順位方向は`Func::orderByRule`とルール48の採点設定を使い、同点では最初の報告を採用する。過去の報告は残す。`is_active=false`または`deleted_at`のある報告は表示対象外。ボーダーは機種ごとに表示し、削除後は同機種の次点へ戻る。

ルールとステージの組合せはLaravel側でも検証する。48は公開済み対象だけを受け付け、英数字コードも`StageCodes`で内部キーへ変換する。操作方法・年・投稿難易度別の報告には分割しない。年別表示を選んでいても現在有効な世界記録を参考表示する。

### APIと画像

- Next `GET /api/world-records?stage=...&rule=...` → Laravel `GET /api/world-records/{stage}/{rule}`：機種別の最良の有効報告を`records`配列として返す。互換用`record`は先頭、該当なしはnull。
- Next `POST /api/world-records` → Laravel `POST /api/world-records`：multipart。NextAuth、same-originの既存アクセス制御、現在のUser、Next→Laravelの署名を検証する。投稿者や有効フラグをブラウザ入力で上書きしない。Laravelは無署名・テスト用署名を拒否し、20回/分の制限を設ける。
- 汎用Next proxyからの世界記録の書き込みはPOST・DELETEとも拒否する。専用APIだけを使用する。
- 画像は一般投稿と同じpublicディスクの`img/`にランダムな`world-...`名で保存し、既存`/api/file/{file}`→`/api/img/{file}`で表示する。画像配信先をpublicディスク指定へ統一し、ファイル名・存在も検証する。
- DB保存失敗時の画像と、Next側で処理が完了したアップロード一時ファイルを削除する。秘密値・Cookie・生の例外やレスポンスを診断ログへ出さない。

### 管理者による論理削除と報告制限

- Next `GET /api/world-records?action=capabilities`は認証DBの現在のロールを再照会し、署名経由でLaravelの`can_report`・`can_delete`を取得する。削除数や制限理由は返さない。未ログイン時は両方false。
- 現在の管理者ロール10だけに`fa-trash-can`を表示する。「この世界記録を削除しますか？」の確認後、Next `DELETE /api/world-records?id=...`→Laravel `DELETE /api/world-records/{id}`で論理削除する。投稿自体と証拠画像は保持する。
- 管理者に削除された報告が利用者単位で通算3件以上なら世界記録報告ボタン・送信を非活性にする。理由は表示しない。APIも403で拒否する。通常の記録投稿には適用しない。
- 同じ投稿の削除を再送しても1件と数える。投稿と削除は`world_record_reporter_locks`の投稿者単位の行ロックで直列化し、3件目の削除との競合で制限を回避しない。別の利用者には影響しない。
- 非ログイン・無署名・テスト署名は投稿と削除を許可しない。一般利用者は削除不可で、入力したroleや投稿者IDは信頼しない。
- 追加migrationは`2026_10_20_000002_add_world_record_platform_and_moderation.php`。旧報告はSwitch固定対象だけplatform=4へ移行し、2機種対象の旧報告は推測せずnullのまま保存・表示対象外にする。既存データがある環境では、証拠で機種を確認して分類する。

## 世界記録ボーダー

`RankingStandard`へ有効な世界記録を渡し、通常投稿のスコアとの位置関係に応じてボーダーを挿入する。通常投稿と同点の行は先に表示し、それより劣る最初の行の前へ挿入する。全投稿が上回る場合は末尾、投稿なしでも有効報告があれば表示する。

「70万点参考スコア」と共通の`ReferenceScoreBorder`を使用し、文字色`#e81fc1`・下線`2px dotted #e81fc1`・中央寄せ・上下8pxの余白を共有する。保持者名と、通常のスコア整形関数による記録を表示する。

証拠画像があるときは写真アイコンを表示する。クリックで画像ダイアログ、Escape・背景クリックで閉じる。

## パンくず・ルール切り替え

- ルール48の上位カテゴリは通常総合（2）。特殊総合（3）へ分類しない。
- 元ページと異なる一覧を表示中に元ページと同じURLの「通常ルール」を押した場合も、一覧stateを元へ戻す。ルート変更時はステージ・ルール・操作方法・年の変更を見てstateを初期化する。
- ステージ401・41 → ダンドリバトル → ゲキカラダンドリチャレンジ → 通常ルールで12件に復帰すること、復帰後の通常ルール再押下で総合41へ移動することを確認する。

## 初回導入時の検証

- migration：`2026_10_20_000001_create_world_record_reports.php`。開発DBへこの追加migrationのみ適用済み。DB初期化は行わない。
- Laravelの記録・認定・世界記録・年別・採点・公開境界等の関連60件が成功。最初の画像配信テストではpublicディスクのfakeと既定ディスクの参照先が異なって失敗したため、publicディスク指定へ修正して再確認した。
- Nodeテスト9件が成功。時間の内部表現への変換とルール48の非変換を含む。
- Next lint・最終本番buildが成功。稼働中devと出力先を分離し、`NEXT_DIST_DIR=.next-rule48-dev/world-record-check`で確認した。
- Playwright：専用ユーザーで認定チェック、4項目の報告フォームと固定投稿者、開発用445へ画像付き報告（201）、ボーダー反映、画像の実配信、モバイルの横はみ出しなし、パンくず、上記ルール切り替えを確認。合成レスポンスの認定記録でアイコンの順番とツールチップ、ルール41で追加項目が出ないことも確認した。
- 検証中の最初の報告は502だったため、上流へのJSON応答指定と安全な診断項目を整え、画像付き201を再確認した。表示テストの時間期待値は既存形式の`02:30`に合わせた。
- 専用ユーザー、専用ログイン履歴、テスト報告、保存画像を終了処理で削除済み。残存ユーザー・報告0件を確認した。実ユーザーの認証情報は使わず、開発用ステージ445以外の実データへの報告は行っていない。
- 本番変更・コミット・pushは行っていない。

画面：[認定チェック](../output/playwright/dandori-certified-form.png)、[認定アイコン（合成記録）](../output/playwright/dandori-certified-record.png)、[報告フォームPC](../output/playwright/world-record-report-form.png)、[報告フォームモバイル](../output/playwright/world-record-report-mobile.png)、[世界記録ボーダー](../output/playwright/world-record-border.png)。

## 機種別・論理削除の追加検証（2026-10-20）

- 開発DBへ追加migration `2026_10_20_000002_add_world_record_platform_and_moderation.php`を適用。既存の機種未分類報告は0件だった。
- Laravel関連63件成功（`php artisan test --filter='Record|Dandori|ScoreOrder|TopRecord'`）。WorldRecordTestは7件で、ルール34の301/330/331/344/345/350の機種境界、機種別最良値、一般利用者・匿名・テスト署名の拒否、Switch固定の誤入力、管理者削除・再送・次点表示・証拠保持・2件/3件境界・別利用者の独立性を確認。追加した署名拒否・画像保持の観点も同7件を再実行して成功。
- Node `node --test tests/security-and-dandori.test.cjs`は9件成功。時間文字列の変換・不正入力・ルール34の機種境界・ルール48の固定機種を含む。
- Next lintと出力先を分離した本番buildを確認。PHP構文・4つのAPIルート登録も成功。
- Playwrightでは専用の合成ユーザーだけを使用。非ログインのPOST/DELETEが401、現在のDBロールを一般利用者へ変更した後の削除が403でtrash非表示となることを確認。
- ルール34の345へWii U/Switch別に合成報告し、2つのボーダーを確認。時間フォームの00:00:30が内部値390、画面00:30になることを確認。331/34と445/48はSwitch固定・disabled、投稿者もdisabled。
- 確認文、キャンセル、管理者削除200、同機種の次点への復帰、3件目で報告ボタン非活性、別ステージへの直接POSTも403になることを確認。制限理由はUIに出さない。
- モバイル390pxでフォーム横はみ出しなし。右端の既存スワイプ領域が削除操作を遮る問題を検出したため、アイコン群に右余白を設け、モバイルでもクリックで削除確認が開くことを再確認。
- ブラウザ手順の初回はURLのルール指定位置とMUIセレクトのrole指定が不適切で失敗した。正規URL（例`/stage/345/0/34`）と実際のアクセシビリティ属性に合わせて再実行し成功。スクリーンショットは遷移アニメーション完了後に再撮影した。
- 専用ユーザー、ログイン履歴、合成報告、保存画像、投稿者ロックを終了処理で削除。ユーザー・報告・ロックは各0件を確認。検証対象は開発の345/34（合成報告）と331/34・445/48（フォーム確認）で、本番は変更していない。
- MySQLでの同時投稿・3件目削除の競合負荷試験は未実施。SQLiteテストは行ロックの競合を保証しない。実MySQLでの追加migrationと通常の実経路は確認済み。

画面：[2機種のボーダー](../output/playwright/world-record-platforms.png)、[時間入力](../output/playwright/world-record-time-form.png)、[Switch固定・モバイル](../output/playwright/world-record-platform-form-mobile.png)、[モバイル削除確認](../output/playwright/world-record-delete-mobile.png)、[3件削除後](../output/playwright/world-record-report-blocked.png)。
