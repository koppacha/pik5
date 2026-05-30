# Frontend Next

## コーディング規約

- JavaScript の文末セミコロンは付けない。
- React コンポーネントは PascalCase、変数は camelCase。
- CSS-in-JS を基本にする。
- MUI の `sx` は Grid の `xs` と混同しやすいため、インライン調整では `style` prop 優先。
- 片方の分岐が使われない三項演算子は避け、`&&`、`||`、`??` を使う。
- MUI Grid は既存コードで小数 `xs={1.5}` を使っている。スマホ比率調整では `columns={{xs: ..., md: ...}}` と組み合わせる。

## ページ/コンポーネント方針

- `next/pages/total/[...series].js` は通常総合とイベント総合 `/total/4` の分岐点。`series === "4"` の場合は通常総合処理に流さず、イベント総合 API/UI へ分岐する。
- `Totals` は総合カテゴリ切替。イベント総合を追加する場合、既存の `1,2,3` に `4` を加える。
- `CategoryList` は総合カテゴリ/イベントカテゴリの横スクロールリスト用途。イベントカテゴリでは `locale.limited.category` を表示名に使う。
- `EventList` はイベント別ブロック。リンクは仕様上 `/limited/{eventId}` だが、期間限定以外のイベントでリンク先が存在するかに注意する。
- `Record` はランキング行の共通表示。イベント総合用には `scoreUnit`、`rankPointUnit`、`hideRankProgress`、`stampItems` のような props で最小拡張する。
- `RankingStandard` は参考スコアを記録前に挿入する。複数参考スコアが連続する場合は `while` でまとめて挿入する。
- `RankingTotal` は既に `flatMap` + `while` で複数ボーダー連続表示する先例。

## テーマと初期描画

- `next-themes` 任せだけだとライト/ダークの初期描画ズレが起きることがある。
- `_document.js` に初期テーマ反映用インラインスクリプトを置き、描画前に `localStorage.getItem('theme')` から `document.documentElement.dataset.theme` を設定する。
- 保存値が無い場合の既定テーマは `dark`。
- `localStorage` を初回レンダリングで直接参照すると SSR と CSR で Hydration mismatch が起きる。マウント後に読む。
- styled-components は `_document.js` で `ServerStyleSheet` によるSSR収集を行う。直アクセス/リロード時に `data-styled` style タグがHTMLへ出ない場合、styled-components のスタイルが一時的または継続的に未適用になる。
- `next.config.mjs` は `compiler.styledComponents=true` を有効化している。

## Speedrun 表示

- `SpeedRunWrapper` の speedrun ユーザー名解決は、ユーザーID単位の SWR key を使う。
- ユーザー名は頻繁に変わらないため、90日 TTL の `localStorage` 永続キャッシュを使う方針。
- `localStorage` キャッシュは初回レンダリングで直接評価せず、マウント後に読み込む。
- SWR は不要な再検証を抑制する設定に寄せる。

## WebGL / Unity

- Unity WebGL ビルドは、既存生成 `index.html` が相対パス前提の場合、Next ページへ直接移植せず `public` 配下の HTML を iframe で読むのが参照崩れが少ない。
- `.data.br`、`.framework.js.br`、`.wasm.br` は通常静的配信だけでは失敗する可能性がある。
- Next 側で Unity の `.br` ファイルに `Content-Encoding: br` と適切な `Content-Type` を設定する。
