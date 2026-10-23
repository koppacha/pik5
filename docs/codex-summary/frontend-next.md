# Next.js UIの方針と契約

## 規約と描画

- JavaScriptは文末セミコロンなし。ReactはPascalCase、変数はcamelCase。片方が使われない三項演算子は `&&` / `||` / `??` にする。
- CSS-in-JSを基本とし、インライン調整は `style` を優先。MUI Gridのxsとsxを混同しない。小数xsを使う既存レイアウトではcolumnsと合計比率を確認する。
- Pages RouterのSSRとCSRの一致を保つ。localStorageはマウント後に読み、初期themeは `_document.js` のスクリプトで適用する。保存なしの既定はdark。
- styled-componentsは `_document.js` のServerStyleSheetと `compiler.styledComponents=true` を維持する。直アクセスでもdata-styledが生成されることを確認する。
- Google Fontsは `next/lib/googleFonts.js` のnext/font。rank-typeはライトKrub300、ダークKulim Park200。
- HelperTextは背景ごとに配色する。白背景Dialogの既定は濃色、テーマ連動背景には `form-helper-text-themed` を付ける。ページのdark状態だけで全ヘルパーを明色へ変えない。
- フッター非表示は `Component.hideFooter` をLayoutへ渡す。サインアップではハンドルネーム注意事項を常時表示し、文字制約はAPIとも揃える。

- 初回表示は `_document.js` のLoadingと `__next.inert` で操作を抑止し、`_app.js` でルーター準備・セッション確認後に解除する。SPA遷移のLoadingとは別に維持する。`pageshow` では離脱用Loadingを除去する。

## ランキング・ナビゲーション

- `total/[...series].js` はID4でイベント総合へ分岐する。通常総合の処理を流用しない。SSR / cache方針は [通信とキャッシュ](caching-and-performance.md)。
- イベントカテゴリはlocaleの全定義を表示。`eventCategoriesWithStageList` の対象はEventListを表示する。261009は `/limited/tricks?261009`、他イベントは `/limited/{eventId}`。
- パンくずのイベントID→カテゴリ解決は `/api/event-category/{eventId}`。未登録や非公開対象を推測で公開導線へ出さない。
- 年別ページも通常・特殊・期間限定・RTAの全行を `Record.js` で表示する。年付きリンク・RTAリンク・複数走者・RP非表示は任意propsで指定し、未指定の既存ページの表示を保つ。
- Recordは共通のランキング行。イベント用単位・stampItems・0表示・rank progressの抑止などはpropsで拡張し、通常記録の挙動を保つ。
- 参考スコアが連続する場合はwhile等で全件を記録より前へ挿入する。総合のscore / RPS切替はAPI互換の反転を正規化する。[採点契約](records-and-scoring.md)。
- ユーザーページの「ユーザー別ページ」はリンクなし。基礎情報の初投稿日と登録日を区別する。比較対象ユーザーが存在しない場合は未定義propsを渡さず404にする。
- PCのシリーズメニュー再押下は対象総合へ、イベントは `/total/4`、本編RTAはSpeedrun.comへ。遷移先未定義は閉じる。

## その他・RTA・ルール48

- シリーズトップ10 / 20 / 30 / 40はStageList下にSpecialStagesを表示する。自身で8列Gridを持ち、スマホでは領域内横スクロール。全角括弧直前でラベルを改行する。
- 総合ページの通常StageListは最大5行（10列×50件）。超過時は固定5行の領域内を縦スクロールし、PC・モバイルともスクロールバーを隠す。既存の横スクロールは維持する。RTA等のSpecialStagesはこの制限の外に置き、個別ステージページには5行制限を適用しない。
- その他ステージはseries一致・900〜1000を基本とし903除外。RTAはspeedrunStageConfigsの該当シリーズ、31X除外。`/api/stages/...` は `include_special=1` 指定時だけstages / specialStagesオブジェクトを返す。
- ステージの現在ルール・表示リストのルール・切替モードは別state。従来ルール / 追加ルール / rule91の再押下動作を保ち、操作方法と集計年を引き継ぐ。
- 一覧だけ別ルールへ切り替えた後、現在と同じURLの通常ルールを押しても一覧stateを復帰させる。元ステージ・ルール・操作方法・年が変わった場合も一覧stateを初期化する。48のパンくずは通常総合へ分類する。
- ルール48は動的カタログを使う。英数字stage_codeと内部stage_idを分け、seriesはmetadataから取得する。既存数値ID用の百の位判定を拡張IDへ適用しない。
- 月次ボックス、管理フォーム、公開前境界は [ルール48](security-and-rule48-planning.md)を参照する。

## トップ・動画・外部コンテンツ

- WelcomeBlockは主要4タイトル・キーワード・Discordの6リンク。認証導線は上部右寄せ。開催中大会はAPIの大会日時で表示し、固定テストIDを使わない。
- ダンドリ検定の総合リンクはトップボックスのヘッダー右端へ白文字で置く。NextEventはイベント取得済みでidがある場合だけ外枠ごと描画し、未取得・イベントなし・取得失敗でデータがない場合は空のGrid枠も残さない。
- `disablePickupVideoAutoplay` は最初の動画だけを止める。設定はSSRで取得し、手動再生後や次動画は従来どおり自動再生する。
- YouTubeの `youtubei/v1/log_event` は埋め込み内部から発生する。`ERR_BLOCKED_BY_CLIENT` はクライアント側の遮断であり、サイトAPIの429やJWT失効と区別する。ログ送信だけを止める公式player parameterは掲載されていない。調査・遮断試験は [トップ通信調査](../top-reload-429.md) を参照する。
- イベント動画は `next/lib/pickupVideo.js` により元ステージの翻訳名（未登録なら元DB名）＋カードルール名。投稿stage / ruleを変更せず、次動画にも同じ判定を使う。
- Speedrunユーザー名はユーザーIDごとのSWR keyと90日localStorage cache。初回renderでlocalStorageを読まない。
- Unity WebGLはpublicのHTMLをiframeで参照し、br圧縮資産にContent-EncodingとContent-Typeを設定する。相対パス前提の生成HTMLを直接移植しない。
- 新規UIの検証はPC / スマホ・テーマ・hydration・操作・権限を対象にする。大会canvasは [大会UI](tricks-ui.md)の停止・破棄条件も確認する。
