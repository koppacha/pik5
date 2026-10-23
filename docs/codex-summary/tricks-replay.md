# 第19回リプレイ

- `TrickReplayService` と公開GET replay / snapshot / batch API、Next時計アイコン・固定シークバーを使用する。第19回のリプレイ公開は配備記録あり。現在の成果物存在は対象環境で確認する。
- 非公開成果物は `laravel/storage/app/tricks/replay/261009`。Git外のチェックポイント群も配備対象。公開に内部監査列・認証情報を含めない。
- ログ直後と15分刻みを復元し、同時刻はlog_idで順序を維持。補充は次チェックポイント、スコア訂正は投稿時へ遡及、証拠・操作方法・コメントは最新という仕様。完全な当時DBそのものではない。
- ドラッグ中は日時のローカル表示のみ、解放時に復元。先読みbatch最大8、保持最大24。停止・切替・離脱でabortと世代判定を行う。
- read_onlyはUI・handler双方で強制。ライブpolling、時計、自動回収・給付・変更APIへ接続しない。再生のためにレート上限を引き上げない。
- live_total_rewardは表示原資S+B+C+P、provisional_total_rewardは未投稿なら0。回収実支払0と未投稿札の原資表示を混同しない。ポット二重加算を避ける。
- 最終カード状態・DP・RP・テイク・ポット・有効投稿数と差分復元を照合する。以後のルール改修を第19回へ遡及しない。
- Playwrightでシーク、前後1コマ、先読み、解除、取得数、変更送信0、静止時描画0、離脱後解放を検証する。詳細は `next/pages/limited/tricks/docs/tricks-replay-implementation-2026-10-12.md`。
