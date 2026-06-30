# 期間限定ランキング・トリックテイキング制 UI設計書
対象：期間限定ランキング・トリックテイキング制（Next.js + Laravel + Phaser 4 + Three.js）  
目的：ルールブックをUI/UXとAPI/DB仕様に落とし込み、実装可能な粒度まで確定する。

---

## 1. 前提条件
- 「トリックテイキング」はメインプロジェクト配下に単一ページで表示する子プロジェクト（特設ページ）である
- この子プロジェクトは`/next/pages/limited/tricks/`に単一ページとして表示する
- ルールの正本は`next/pages/limited/tricks/docs/tricks-rules.md`とし、本ドキュメントはUI・DB・APIへの落とし込みを担当する
- 既存の投稿UIは`next/components/modal/RecordForm.js`を利用し、ランキング表示は`next/components/record/Record.js`をmini表示で利用する
- 既存のプロトタイプ実装として`next/pages/limited/TrickTaking.js`、`next/components/limited/*`、`laravel/app/Http/Controllers/CardController.php`があるが、本実装ではAGENTS.mdに従いイベント専用処理を`TrickController.php`へ集約する方針とする
- 即時反映は短周期ポーリングを前提とする。ポーリングで大会運営上の遅延・負荷が問題になる場合にのみ、WebSocketまたはSSEを追加検討する

## 2. 画面構成
- canvasは画面いっぱいに表示する（既存のレイアウト制限は無視し、グローバルヘッダー以外表示しない）

### 2.1. サイト名等
- 左上固定表示
- サイト名、大会名、ログ、大会残り時間を表示する
- ログは最大10行までとし、100行までスクロールできる。101行目以降は取得しない
- ログはバックエンドを短周期ポーリングで監視して反映する
- サイト名をクリックでサイトトップページ`/next/pages/index.js`に遷移する

### 2.2 ダッシュボード
- 中央上・右固定表示（サイト名等とあわせてヘッダーを構成）
- 全参加者のプレイヤー名、ドローポイント、手札枚数、合計ランクポイントが合計ランクポイント降順に一覧表示
- 一度に表示できるのは10人までとし、11位以下はスクロールして表示する。
- ダッシュボードの内容はバックエンドを短周期ポーリングで監視して反映する

### 2.3 場札
- 中央表示（**スクロール可能領域。**ヘッダー・フッター以外のすべての表示領域を占有）
- 場札のカードコンポーネントを残り時間が少ない順に左上から右下に向かって表示

### 2.4 山札
- 左下固定表示
- カード裏面と「ドロー」ボタン、山札の残り枚数を表示
- ドローボタンはユーザーのドローポイントが０のとき、非活性にしAPIを発火できないようにする

### 2.5 手札
- 中央下・右固定表示（山札と手札でフッターを構成）
- 手札のカードコンポーネントをドローした順に左から表示する
- 人間が手に持っているように扇状に配置し、各カードコンポーネントは常に全域表示する必要はない
- 可能ならドラッグで並び替えできるようにする

---

## 3. 各コンポーネントの動作処理

### 3.1 手札クリック時の動作
- 選んだ手札を全体像が確認できる位置へ移動し、「テイク」「キャンセル」ボタンを表示する
- キャンセルボタンかモーダル外領域をクリックすると手札は元の位置に戻る

### 3.2 テイクボタンクリック時の動作
- 「手札をすべて消費してこのカードを場に出しますか？」という確認モーダルを表示（はい/キャンセル）
- 確認モーダルで「はい」を押下すると確認モーダルと手札モーダルを閉じ、選んだカードの場札フラグをONにする（場札に選んだ手札が表示される）
  - 手札から場札の領域へシームレスに移動する
  - 場札は公開状態になるが、この時点ではリミットオーバー時間をセットしない
  - 1回目のスコア投稿が正常完了した時点で、現在時刻から90分後をリミットオーバー時間としてセットする
- 残りの手札はすべてスタックフラグをONにして、手札からは消滅する

### 3.3 場札クリック時の動作
- 選んだ場札のカードコンポーネントとそのゲームに投稿されたスコアがモーダル表示される（場札モーダル）
- 場札モーダルの各スコアは汎用記録コンポーネント（`next/components/record/Record`）をminiフラグをONにして表示する
    - rps表示領域については、「スタック数 - 順位 + 1」をRPSとして表示する
- ランキングの上部に投稿ボタンを表示し、クリックすると投稿モーダル（`next/components/modal/RecordForm`）を表示し、そのゲームへのスコアを投稿できる

### 3.4 スコア投稿成功時の動作
- 該当カードにまだリミットオーバー時間がない場合、現在時刻から90分後をリミットオーバー時間としてセットする
- 2回目以降の投稿では、ルール仕様書の延長条件を満たす場合に限りリミットオーバー時間を15分延長する
- 各プレイヤーの合計ランクポイントを再計算する

### 3.5 未参加者のアクセス時の動作
- ダッシュボードに記載されていないユーザーが大会時間内にページへアクセスした場合、参加モーダルを強制ポップアップする（大会時間外の場合、参加ボタンは非活性にする）
- ログインしている場合：参加モーダルには参加ボタンとキャンセル（観戦）ボタンを配置し、参加ボタンを押下するとダッシュボードに名前が並び、初期３枚の手札を自動ドローする
- ログインしていない場合：「このイベントに参加するにはログインが必要です」と表示し、ログイン画面へのリンクとキャンセルボタンを配置する
- キャンセルボタンを押すとモーダルを閉じ、ヘッダーに再度参加モーダルを表示するための「参加」ボタンを表示する（このボタンは参加モーダルでキャンセルボタンを押し、引き続き未参加の場合のみ表示する）

### 3.6 特殊な動作
- 各場札はクライアント側で毎秒表示更新する。リミットオーバー時間を過ぎた場札があれば、短周期ポーリングまたは明示API呼び出しにより回収処理を反映する
- リミットオーバー時間が未設定の場札は、最初の投稿待ちとして扱い、回収対象にしない
- 大会残り時間が０になった場合、すべてのボタンを非活性にし、回収された場札を再公開する

### 3.7 Game Studio適用後のUI責務分離
- Game Studioの方針に従い、ゲーム状態の正本はLaravel APIのスナップショットとし、Phaser Sceneは描画・入力・Tween・パーティクルのアダプタとして扱う
- レンダラー非依存の判定や整形（期限切れ判定、残り時間表示、手札順、場札順、短縮表示など）は`next/lib/tricks.js`に置く
- Phaser canvasはカード操作と視覚演出を担当する。具体的には、手札扇形配置、ドラッグ中断時の座標復帰、山札→手札、手札→場札、場札選択時の座標移動、パーティクルを扱う
- ログ、ダッシュボード、ランキング、投稿フォームなど、スクロールやテキスト密度が高いUIはDOM/React側で扱う
- 場札詳細はPhaser側で選択カードをモーダル表示位置へ移動させ、その後React/MUIのモーダルでランキングと投稿導線を表示する

### 3.8 レンダリング負荷に関する制約
- 本イベントは低スペックPCの参加者も想定するため、見栄えのために過剰なローカルリソースを消費してはならない。フルスクリーンcanvasを使う場合でも、静的な状態で高fps描画を続ける、重いフィルターや大量パーティクルを常用する、不要に大きい描画領域を維持する実装は避ける
- Phaser Sceneの再描画では、古いGameObject、Tween、イベントリスナー、DOM要素を確実に破棄する。`children.removeAll()`のように表示リストから外すだけの処理に依存せず、必要に応じて`destroy()`やTween停止を明示する
- ポーリングやSWR更新で画面全体を再生成する場合は、更新頻度を必要最小限にする。回収・投稿・テイクなど状態変化が発生した時は即時再取得してよいが、状態変化のない監視処理で毎秒全再描画を誘発しない
- レンダリングに関わる改修をした場合は、Playwrightでcanvasが描画されることだけでなく、常時描画fps、オブジェクト数の増加、ポーリング間隔、画面を開いたままにした時のCPU/GPU負荷を確認する
- 過負荷または過負荷になりうる実装を検知した場合は、仕様・要件の範囲内で軽量化を優先する。具体的にはfps制限、差分更新、描画オブジェクトの再利用、パーティクル数削減、エフェクトの簡素化、canvasサイズ抑制、API再取得頻度の調整を検討し、実装可能なものはその場で反映する

---

## 4. コンポーネントの詳細仕様

### 4.1 カードコンポーネント
- `/next/components/limited/Card`も参考にする（プロトタイプ版のカードコンポーネント）
- 固定の大きさで表示する
- カード名、ルール名、ルール詳細、作成者、テイク者、難易度（★1〜★5）、残り時間を表示
- カードの縁でレア度を表現する。コモン〜アンコモンはモノクロ、レアは有色、エピックはグラデーション、レジェンダリーはグラデーションのアニメーション

---

## 5. バックエンドの仕様

### 5.1 データベース
- カードの状態管理等は`decks`テーブルがすでにあるので、これを利用する
    - 「誰かの手札（ユーザーID）」「場札」「山札」「回収済み」「捨て札」の判別は`state`カラムを使う
- ゲームの記録は`records`テーブルを利用する（非イベント時も使う汎用記録テーブル）
- `records`へのカラム追加はしない想定。必要な場合ユーザーの承認を要する。`decks`のカラム構成は必要に応じて変更してよい。
- 各カードにはカード固有IDとして`card_id`を付与する。`stage_id`は投稿先となる`stages.stage_id`であり、テイクされた時点で初めて払い出す
- 既存migrationには`eventId`、`stageId`、`ruleName`、`topPlayer`などcamelCaseカラムが存在する。`stageId`は元ステージ番号として扱い、追加カラムでは`origin_stage_id`へ寄せる

### 5.1.1 `decks`テーブル設計
`decks`はカード本体とカード状態を管理する中心テーブルである。既存カラムを活用しつつ、不足する状態管理カラムは追加を検討する。

| カラム                         | 型                             | 必須 | 用途                                                                 |
|-----------------------------|-------------------------------|----|--------------------------------------------------------------------|
| `id`                        | unsigned big integer          | 必須 | カードID。内部操作の主キー                                                     |
| `card_id`                   | unsigned big integer          | 必須 | イベント内でカードを識別する固有ID                                                |
| `event_id`                  | unsigned integer              | 必須 | 大会ID。既存`eventId`相当                                                 |
| `stage_id`                  | unsigned integer nullable     | 任意 | テイク時に払い出される投稿用ステージ番号。`stages.stage_id`と紐づく                         |
| `origin_stage_id`           | unsigned integer nullable     | 任意 | カードの元になった既存ステージ番号。既存`stageId`相当                                    |
| `title`                     | string                        | 必須 | カード名・ステージ名                                                         |
| `rule_name`                 | string                        | 必須 | 縛りルール名。既存`ruleName`相当                                              |
| `text`                      | text                          | 必須 | ミニゲームのルール本文                                                        |
| `state`                     | string                        | 必須 | `_deck`、`_field`、`_stack`、`_trash`、`_collected`、または手札所有者の`user_id` |
| `difficulty`                | unsigned tiny integer         | 必須 | 難易度1-5                                                             |
| `rarity`                    | unsigned tiny integer         | 必須 | レア度1-5。ドロー時に抽選結果で上書きされる                                            |
| `stack_count`               | unsigned integer              | 必須 | テイク時点の手札枚数S。既存`rewards`はこの用途として再定義または置換する                          |
| `creator`                   | string nullable               | 任意 | 考案者のユーザーIDまたは表示名                                                   |
| `taker`                     | string nullable               | 任意 | テイクしたユーザーID                                                        |
| `top_player`                | string nullable               | 任意 | 現在トップのユーザーID。既存`topPlayer`相当                                       |
| `post_count`                | unsigned integer              | 必須 | 対象`stage_id`への有効投稿数。既存`count`相当                                    |
| `limit_at`                  | datetime nullable             | 任意 | リミットオーバー時刻。初回投稿まではnull                                             |
| `taken_at`                  | datetime nullable             | 任意 | テイクされた時刻                                                           |
| `collected_at`              | datetime nullable             | 任意 | 回収された時刻                                                            |
| `stack_parent_id`           | unsigned big integer nullable | 任意 | `_stack`カードが紐づく場札の`decks.id`                                       |
| `drawn_order`               | unsigned integer nullable     | 任意 | 手札内の表示順。ドラッグ並び替えを実装する場合に利用                                         |
| `created_at` / `updated_at` | timestamp                     | 必須 | Laravel標準タイムスタンプ                                                   |

状態値の定義は以下とする。

| state        | 意味                         |
|--------------|----------------------------|
| `_deck`      | 山札                         |
| `{user_id}`  | 指定ユーザーの手札                  |
| `_field`     | 場札。投稿可能または初回投稿待ち           |
| `_stack`     | 場札に紐づくスタックカード。他ユーザーには内容非公開 |
| `_trash`     | 捨て札。山札枯渇時の再シャッフル対象         |
| `_collected` | 回収済みカード。大会終了後に再公開する        |

### 5.1.2 `players`テーブル設計
参加者の大会内状態を管理する。既存`players`テーブルを利用する。

| カラム                         | 型                    | 必須 | 用途                         |
|-----------------------------|----------------------|----|----------------------------|
| `id`                        | unsigned big integer | 必須 | 主キー                        |
| `name`                      | string               | 必須 | 既存ユーザーID。重複参加防止のためユニーク化を推奨 |
| `draw_points`               | integer              | 必須 | ドローポイント                    |
| `rank_points`               | integer              | 必須 | 合計ランクポイント                  |
| `card_count`                | integer              | 必須 | 手札枚数のキャッシュ。`decks`実数と同期する  |
| `created_at` / `updated_at` | timestamp            | 必須 | Laravel標準タイムスタンプ           |

### 5.1.3 `records`テーブルの扱い
- スコア投稿は既存の汎用`records`テーブルを利用する
- テイク済みカードにのみ投稿用`stage_id`が付与されるため、イベント投稿は`records.stage_id = decks.stage_id`で紐付ける
- `records`へのカラム追加は行わない
- イベント専用ステージ番号の投稿は新着記録APIやピックアップ動画選出から除外する

### 5.1.4 `limit_logs`テーブル設計
行動ログと監査ログには既存の`limit_logs`相当のログテーブルを利用する。

| カラム                                             | 用途                                                                |
|-------------------------------------------------|-------------------------------------------------------------------|
| `event`                                         | `join`、`draw`、`take`、`record_posted`、`limit_extended`、`collect`など |
| `actor_name`                                    | 操作したユーザーID                                                        |
| `card_id` / `stage_id`                          | 対象カード                                                             |
| `from_state` / `to_state`                       | 状態遷移                                                              |
| `rank_points_delta` / `draw_points_delta`       | ポイント変動                                                            |
| `stacked_card_ids`                              | テイク時にスタックへ移動したカードID配列                                             |
| `card_snapshot` / `player_snapshot` / `context` | デバッグ・監査用JSON                                                      |
| `created_at`                                    | ログ表示順の基準                                                          |

### 5.2 状態変更時のバックエンド処理
- 以下に該当する場合、または類似操作時は`decks`の該当ステータスを更新する
    - ドローされたとき（山札→誰かの手札）
    - テイクされたとき（誰かの手札→場札またはスタック）
    - 回収されたとき（場札・スタック→捨て札）
- 同時アクセスに備え、参加・ドロー・テイク・投稿後更新・回収はDBトランザクション内で処理し、対象の`players`行と`decks`行をロックする
- ポーリングで取得する状態は、サーバー側で正規化したスナップショットとして返す。クライアントは楽観的に確定状態を書き換えず、API応答または次回ポーリングで同期する

### 5.3 ドロー時のバックエンド処理
- まず、以下の確率分布に従ってレア度抽選を行う
    - コモン(C1)：82%、アンコモン(U2)：10%、レア(R3)：5%、エピック(E4)：2.5%、レジェンダリー(L5)：0.5%
- 次に、以下の確率分布に従って難易度抽選を行う
    - ★1：54%、★2：30%、★3：10%、★4：5%、★5：1%
    - 抽選前に`decks`の山札に該当するカードを調べ、山札に１枚もない難易度が１つ以上存在する場合はその確率の合計を存在する難易度のうちもっとも低い難易度に上乗せする（例：山札に★3が存在せず、{★1,2,4,5}が存在する場合の確率分布は{64%,30%,5%,1%}となる）
- 抽選後、山札の該当難易度からランダムにカードを１枚決定し、そのカードのレア度をレア度抽選の結果の値に書き換え、`state`の値をドローしたプレイヤーにする（＝手札として扱う）
- ドロー前に山札が空の場合、`_trash`のカードを`_deck`へ戻してシャッフル対象にする
- ドロー成功時は`players.draw_points`を1減算し、`players.card_count`を`decks`実数に同期する

### 5.4 テイク時のバックエンド処理
- まず、テイクできるか判定する
- テイクできる場合、手札の`state`を切り替える（選んだ手札は場札として、それ以外はスタックとして扱う）
- テイクできない場合はそもそもテイクボタンを活性化しない
- サーバー側でも必ず以下を検証する
    - 対象カードが操作ユーザーの手札である
    - 操作ユーザーの手札が3枚以上
    - 大会終了1時間前より前
    - 場札数が`参加者数 + 5`未満
    - 場札数が15枚以下
- 選択カードは`state = '_field'`、`taker = user_id`、`stack_count = テイク直前の手札枚数`、`taken_at = 現在時刻`に更新する
- 選択カードに`stage_id`が未設定の場合、イベント用ステージ番号を1313から順に払い出し、`stages`へステージ情報を作成してから`decks.stage_id`へ保存する
- 今回イベントの`stages`作成値は、`stage_sub = "期間限定チャレンジ"`、`type = "stage"`、`display = "int"`、`parent = 260704`、`series = origin_stage_idの先頭1桁`、`time/treasure/pikmin/border1-4 = 0`とする
- 選択されなかった手札は`state = '_stack'`、`stack_parent_id = 選択カードのid`に更新する
- テイク時点では`limit_at`は設定しない。初回投稿時に90分カウントダウンを開始する

### 5.5 記録投稿時のバックエンド処理
- 投稿された記録はテイク時に払い出した`stage_id`を使って記録投稿処理を行う
- このイベントで投稿された記録は新着記録API（`/api/new`）では取得しない（ピックアップ動画選出ロジックでも対象外になる想定）
- 投稿成功後、`records.stage_id`に一致する`decks`の場札を取得し、投稿数・トップ投稿者・リミットオーバー時刻・ポイントを更新する
- 対象場札の`limit_at`がnullの場合、現在時刻から90分後をセットする
- 対象場札の`limit_at`が設定済みの場合、ルール仕様書の延長条件を満たすときだけ15分延長する
- 直近15分以内で5回目以降の投稿、同一プレイヤーによる連続投稿、大会終了1時間前以降の投稿では延長しない
- 投稿したスコアが最下位でなく、かつ同一プレイヤーの前回投稿より順位が上がった場合、レア度とスタック数に応じてドローポイントを加算する
- ランクポイントは対象`stage_id`の有効投稿を集計し、各プレイヤーの最高スコアを基準に再計算する

### 5.6 回収時のバックエンド処理
- 短周期ポーリングまたは期限切れ一括回収APIにより、回収条件を満たしている場札を回収する
- 回収対象は`state = '_field'`かつ`limit_at`が現在時刻以前のカード、または大会終了時の全場札とする
- 回収時は対象場札を`_collected`、紐づく`_stack`カードを`_trash`へ更新する
- 回収時点のランキングに基づき、上位S人へランクポイント、上位S人へ難易度に応じた追加ドローポイントを反映する
- 回収処理は冪等にする。すでに`_collected`のカードに対して再度回収APIが呼ばれても、ポイントを二重加算しない

## 6. Laravel API設計

### 6.1 基本方針
- Laravel側のイベント専用APIは`laravel/app/Http/Controllers/TrickController.php`へ定義する
- Next.jsからは既存の`/api/server/[...query].js`プロキシ経由でLaravel APIを呼び出す。例：Laravel pathが`/api/tricks/state`の場合、フロントエンドからは`/api/server/tricks/state`を呼ぶ
- 認証ユーザーIDはNextAuthのセッションを基準にし、クライアントから送られた`userId`だけを信用しない
- 全APIはJSONを返す。失敗時はHTTPステータスと`message`を返す

### 6.2 取得系API

| Method | Laravel path                        | 用途              | 主なレスポンス                                             |
|--------|-------------------------------------|-----------------|-----------------------------------------------------|
| GET    | `/api/tricks/tournament`            | 大会情報取得          | `event_id`、`start_at`、`end_at`、`server_now`、`debug` |
| GET    | `/api/tricks/state`                 | 画面全体のスナップショット取得 | 大会情報、参加者、場札、自分の手札、山札枚数、捨て札枚数、ログ                     |
| GET    | `/api/tricks/players`               | ダッシュボード取得       | 参加者一覧                                               |
| GET    | `/api/tricks/hand`                  | 自分の手札取得         | 手札カード一覧                                             |
| GET    | `/api/tricks/field`                 | 場札取得            | 場札カード一覧                                             |
| GET    | `/api/tricks/cards/{deckId}/scores` | 場札ランキング取得       | 対象`stage_id`の有効投稿ランキング                              |
| GET    | `/api/tricks/logs`                  | ログ取得            | 最新100件の表示用ログ                                        |

`/api/tricks/state`はポーリングの中心APIとする。初期値は2-5秒間隔を想定し、投稿直後・テイク直後などは即時再取得する。

### 6.3 更新系API

| Method | Laravel path                               | 用途       | 主な処理                                    |
|--------|--------------------------------------------|----------|-----------------------------------------|
| POST   | `/api/tricks/join`                         | 大会参加     | `players`作成、初期3枚ドロー                     |
| POST   | `/api/tricks/draw`                         | 1枚ドロー    | ドローポイント消費、山札抽選、手札追加                     |
| POST   | `/api/tricks/cards/{deckId}/take`          | テイク      | 条件検証、場札化、スタック化                          |
| POST   | `/api/tricks/cards/{deckId}/collect`       | 回収       | 場札回収、ポイント反映、ログ記録                        |
| POST   | `/api/tricks/cards/{deckId}/debug-collect` | デバッグ回収   | デバッグモード時のみ即時回収                          |
| POST   | `/api/tricks/records/posted`               | 投稿成功後更新  | `RecordForm`投稿成功後に呼び、カウントダウン・ポイント・ログを更新 |
| POST   | `/api/tricks/maintenance/collect-expired`  | 期限切れ一括回収 | ポーリングまたは管理操作で期限切れカードを回収                 |

### 6.4 投稿APIとの連携
- 実際のスコア投稿は既存の`next/components/modal/RecordForm.js`から`/api/server/post`へ送る
- 投稿フォームには対象カードの専用`stage_id`を`stage_id`として渡す
- 投稿モーダルのステージ名は、ローカライズ辞書に存在しない場合、`stages.stage_name`またはカードタイトル由来の名称を表示する
- `/api/server/post`が成功した後、フロントエンドはプロキシ経由で`POST /api/server/tricks/records/posted`を呼び出し、イベント固有の状態更新を行う
- 将来的には`RecordController`側から`TrickController`を呼ぶ形へ寄せてもよいが、まずはイベントページ側から投稿成功後APIを呼ぶ実装を優先する

### 6.5 エラー仕様

| ステータス | 用途                         |
|-------|----------------------------|
| 400   | リクエスト形式不正                  |
| 401   | 未ログイン                      |
| 403   | 大会時間外、未参加、権限なし、デバッグ無効      |
| 404   | 対象カードなし                    |
| 409   | 状態競合。すでに回収済み、手札でない、場札数上限など |
| 422   | 入力値は正しいがルール条件を満たさない        |
| 500   | 想定外エラー                     |

## 7. テスト工程

### 7.1 Playwright UI/APIテスト
- 本サブプロジェクト専用のPlaywright設定は`next/pages/limited/tricks/playwright.config.cjs`、テスト本体は`next/pages/limited/tricks/tests/*.cjs`に配置する
- `pages`配下でもNext.jsの既定`pageExtensions`に含まれない`.cjs`へ統一し、PlaywrightやMySQLクライアントをNextのページとしてbuildしない
- APIテストは一意なプレイヤー・カード・投稿をMySQLへ投入し、各テストの`finally`で関連データを削除する。既存の大会データを前提にしたり変更したりしない
- Nextコンテナ内から実行する場合、`next/`を作業ディレクトリとして以下を実行する

```bash
npx playwright test -c pages/limited/tricks/playwright.config.cjs
```

- Dockerサービス経由で確認する標準手順は以下とする

```bash
docker compose up -d
docker compose exec laravel php artisan migrate --force
docker compose exec laravel php artisan db:seed --class=TrickDummyDeckSeeder
docker compose exec -d next yarn dev -H 0.0.0.0
docker compose exec next apk add chromium
docker compose exec -e TRICKS_E2E_CHROME_EXECUTABLE=/usr/bin/chromium-browser next npx playwright test -c pages/limited/tricks/playwright.config.cjs
```

- ホスト側から`localhost:3005`へ接続して実行する場合は、`TRICKS_E2E_BASE_URL`を指定する

```bash
TRICKS_E2E_BASE_URL=http://localhost:3005 npx playwright test -c pages/limited/tricks/playwright.config.cjs
```

- Playwright側で開発サーバーも起動したい場合は、`TRICKS_E2E_START_SERVER=1`を指定する。ただしDocker運用時は既存の`next`コンテナで`yarn dev`を起動してからテストする運用を優先する
- Chromiumが未導入の環境では、`next`コンテナ内で`npx playwright install chromium`を実行してから再試行する
- `next`コンテナがAlpine Linuxの場合、Playwright同梱のUbuntu/glibc向けChromiumは実行できないため、AlpineのシステムChromiumを利用する。この場合は`apk add chromium`等で導入し、`TRICKS_E2E_CHROME_EXECUTABLE=/usr/bin/chromium-browser`を指定して実行する。Dockerイメージ側でChromiumを常設した場合は、`apk add chromium`の手順は省略できる

```bash
TRICKS_E2E_CHROME_EXECUTABLE=/usr/bin/chromium-browser npx playwright test -c pages/limited/tricks/playwright.config.js
```

- 現在のUIテストでは以下を確認する
    - `/api/server/tricks/state`がNextプロキシ経由でイベント状態スナップショットを返す
    - 初回投稿で90分タイマーが開始し、条件を満たす次の投稿で15分延長される
    - 最下位ではない順位上昇投稿に対してDPが一度だけ付与される
    - 同じ場札を複数回回収してもポイントと回収ログが重複しない
    - 大会終了後は手札・山札を描画せず、回収済み場札を表示する
    - `/limited/tricks`を開いたとき、Phaserのcanvasが表示され、描画済みピクセルを持つ
- レンダリング関連の改修時は、上記に加えて以下を確認する
    - ページを開いたままにしてもPhaser GameObjectやDOM要素が継続的に増え続けない
    - 静止状態で不要な高fps描画や毎秒の全再生成が発生していない
    - 期限切れ回収などの監視処理が、状態変化のない時に過剰な再取得・再描画を誘発していない
    - 実機またはブラウザのPerformance/Activity Monitorで、CPU/GPU/WindowServer負荷がリリース可能な範囲に収まる
