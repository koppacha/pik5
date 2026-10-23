# トリックUIと描画の制約

- 正本は `next/pages/limited/tricks/docs/tricks-system.md`、コードは `next/components/tricks/` と `next/lib/tricks/`。低負荷の要件と検証は対象 `AGENTS.md` と [テスト方針](testing-and-verification.md)を参照する。
- `/limited/trick` / `/limited/tricks` は共通画面。クエリの大会IDをSSR選択し、取得・操作・投稿・保守へ引き継ぐ。無指定の選択は開催中→近い開催前→最後の終了大会。固定251227前提の説明は廃止。
- 開催中トップボックスは `TricksActiveEvent` が大会APIの日時で判定する。フロントの固定ID・日時を復活させない。SSR / API上のテスト大会認証は別途維持する。
- 観戦は未認証でも可能。コマンド・手札を収納し、変更操作と自動給付 / 回収POSTを止める。解除確認でゲーム変更APIを自動送信しない。
- state / ランキングは通常3秒、観戦公開ログは最新100件の範囲。refreshIntervalの関数参照を安定させ、演出中・閉幕後・リプレイ中・離脱後の停止を確認する。
- 手札の番号はカード表示ID、切り札は投稿先stage_id。creatorは表示文字列で共同名も許可し、ユーザーIDとして名前変換しない。テイカー / ホルダーはユーザーIDを解決する。
- カード本文は全文・スクロール可、140文字まで14px、200まで12px、それ以上10px。通常カード260×363・縁10px、ミニ17×23・縁2pxを維持する。
- 通常レジェンダリー面は白90%不透明、文字・DPは不透明。他カード面は白。テーマ連動の盤面・Dialogと混同しない。
- `TricksCardBorder` の固定SVGとCSS transformを使用する。ミニ・ドロー一時札は静的。通常も画面外 / 非表示 / document.hidden / reduced-motion時は停止し、回収一覧はhover / focus時のみ演出する。
- mask宣言はWebKit用より後に標準mask / mask-composite:excludeを置く。Firefoxでカード面が縁に覆われないことを確認する。
- 切り札はtaken_at降順、手動スクロールはカードと枠へ即時同量反映。テイク演出時だけ有限時間の移動を行う。本文にスクロール余地がある間は一覧wheelを抑える。
- ユーザー情報・ミニカードの実測下端をResizeObserverで共有し、切り札開始・クリップ・結果被覆を同じ保護境界へ揃える。複数行・低い画面・モバイルでも情報領域を覆わない。
- RP / DP / 手札 / 回収の変更は項目別1.8秒点滅、順位変化はブロック全体。初回取得では点滅せず、全体と項目の二重点滅を防ぐ。
- APIの給付・課税フラグを画面で再計算しない。税のthresholdは非課税上限なので表示境界はthreshold+1。
- 管理統計はrole10をAPIでも確認。参加者は現在有効なrecordsのユニークuser_id、投稿数も有効件数。ゲーム用post_countを表示都合で変えない。人気クリエイター指数はPrisma正規名との部分一致で有効参加者を札ごとに加算する。
- 投稿フォームの大会順位は専用 `tricks/rank/...` とevent_idを使う。公開 `record/rank` は開催中大会を除外するため代用不可。
- 遊び方は提供PDF `limited_19_manual.pdf`、ナレッジは `next/pages/keyword/tricks-manual.md` のreadOnly表示。両者の差異は [整合性の注意](tricks-rule-consistency.md)を確認する。
- ヘッダーにモード・通信・エラーを集約。閉幕結果・リプレイでもcanvas / observer / listener / timer / fetchを離脱時に解放する。
