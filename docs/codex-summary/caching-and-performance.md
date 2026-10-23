# キャッシュ・通信・描画負荷

- `next/pages/stage/[...stage].js`、`total/[...series].js` は現行SSRで `private, no-store`。トップもSSR。旧ISR24時間・イベント総合60秒という説明をこれらのページに適用しない。
- 開催中イベントの通常公開除外は `Record::publiclyVisible()`。Laravel公開集計キャッシュも開催中大会集合で分離する。SSR化だけで業務キャッシュの漏洩や更新遅延が解消するわけではない。
- 総合ページのサーバー取得は `next/lib/serverFetchJson.mjs` のnode-fetch。上流非2xxや不正JSONは例外として扱い、一時的障害を空ランキングや404へ変換しない。回帰テストは `next/tests/serverFetchJson.test.mjs`。
- ユーザー一覧は `usersCache.js` に集約し、1時間TTLと処理中Promise共有を維持する。ページpropsの全件埋め込みや投稿ごとの `users.find()` は測定後に削減する。権限検証はキャッシュに依存しない。
- dashboardおすすめ候補はユーザー別1時間キャッシュ。返却時には自己ベストを再取得する。候補ロジックを変えるときはキーの版も更新する。
- おすすめは前年比成長の実体ルールを優先し、不足時は最新通常投稿のルールへフォールバック。拡張ステージ追加時は内部IDの単純範囲判定も再確認する。
- 新着通知は同一ユーザー120分・通知全体1分の抑止とまとめ表示を維持する。YouTubeは11文字ID検証と失敗候補のskip、Discordは取得失敗と0件を区別する。
- `next/font/google` のself-hostとトレンド枠の高さ予約を保持する。過去のHTMLサイズや応答時間を現在の測定値として使わない。
- 大会SWRのrefreshInterval関数は `useCallback` 等で参照を安定させる。秒時計更新で取得タイマーを繰り返し再起動させない。ソート・演出・リプレイ・終了時の通信停止も検証する。
- Nginxの静的SVGと通常APIの共有制限枠による429は過去に観測済み。ソースのmiddlewareだけで本番の実効上限を断定せず、必要時に入口から調べる。
- 新着APIはイベント記録の `score_type` をJOIN済みのstagesから返し、Scoreによるステージごとの追加取得を避ける。通常ステージには一律pointsを付与せず、既存ルールの時間換算を維持する。
- トップSSRはセッションをSessionProviderへ渡し、応答をprivate/no-storeにする。Nginxの認証・一般API・静的アセットの制限枠を分離する設定は `nginx.pik5.conf` / `nginx.pik5-http.conf`。反映・検証は [リロード429](../top-reload-429.md) を参照する。
- Phaserは差分描画・待機時sleep・画面外削減、CSS演出は画面外 / 非表示 / reduced-motion時停止。離脱後のcanvas、observer、listener、timer、通信の解放を確認する。

- 年別 `/date/[year]` はSSR/private/no-store、業務データの過去年だけLaravel Cacheで30日保持。当年は都度計算。RTAは遅延取得し、Nextの `.cache/year-records/` に当年10分／過去年30日保存。管理者の `/api/date/refresh` で失効し、通常revalidateからdateを更新しない。詳細は [年別記録ページ](../yearly-record-page.md)。
