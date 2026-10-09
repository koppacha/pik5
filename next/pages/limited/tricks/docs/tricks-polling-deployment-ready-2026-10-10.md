# ポーリング修正のローカル実装・反映準備

## 指示と変更範囲

ユーザー指示：アクティブ参加者が０人になった際にデプロイできるよう、調査結果に基づきローカルで実装・テストする。今回、本番へは反映しない。

`index.js` のSWR `refreshInterval` 関数を `useCallback` で固定し、依存を `fieldSorting` だけにする。毎秒の時計更新がSWRの３秒タイマーを解除・再設定する問題を解消する。終了状態はコールバックの引数で最新値を判定するため、古いstateを閉じ込めない。

取得周期は３秒を維持。テイク演出中は停止、演出終了後は再開、大会終了後は停止。フォーカス時再検証とSWR既存の非表示／オフライン／エラー時の制御を維持。API・DB・Laravel・認証・レート制限の変更はない。

## 再実行可能な検証

`tests/tricks-polling-smoke.cjs` はPlaywright CLIの `run-code` 用関数。ローカルNextを3005番で起動した状態で実行する。全APIリクエストを架空データで置き換え、認証情報や実DBへの書き込みを使わない。

```sh
/Users/main/.codex/skills/playwright/scripts/playwright_cli.sh --session tricks-polling open http://localhost:3005/limited/tricks
/Users/main/.codex/skills/playwright/scripts/playwright_cli.sh --session tricks-polling run-code "$(cat next/pages/limited/tricks/tests/tricks-polling-smoke.cjs)"
docker compose exec -T next yarn lint --file pages/limited/tricks/index.js
```

毎秒の時計更新と約３秒のstate取得、DP変更の自動反映、終了後停止、実際の合成テイク操作の演出中停止と終了後再開、Nextルーターによる画面離脱時の取得・時計・debug参照の破棄を検証する。静止状態のCanvas描画数・DOM数・Canvas数を比較し、描画用RAF／タイマーの増加がないことを確認する。

開発モードの検証成功：取得間隔3009/3007/3009ms、静止時 `phaserRenderCount=1` が不変、`phaserLoopSleeping=true`、`activeRaf=0`、`activeTimers=0`。テイク直後の `mutate()` による明示更新は正常動作であり、自動ポーリングとは区別する。対象ページlint成功。

ローカル `yarn build` 成功（193.67秒、警告なし）。ビルド前にはローカル開発サーバーを停止し、同じ `.next` への並行書込みを避けた。この検証はローカル環境のみで実施し、本番へ接続・反映していない。

`next start` の本番モードでも同じ検証が成功。取得間隔3007/3009ms、10.5秒間でstate取得が1→4回に増加し、既存の大会時計とヘッダー時計も動作（合計tick 2→22）。カード1枚表示中に `phaserRenderCount=1`、DOMカード数1・DOMノード数173・Canvas数2が不変。RAFは0、描画タイマーは未生成。DP変更の自動反映、終了後6.5秒間の取得停止、テイク後の再開、画面離脱後6.5秒間の取得停止と大会時計・debug参照の破棄を確認した。

開発と本番の違いも検証コードに反映：Canvasが2枚あるため `.first()` を使い、描画タイマー未生成を0として扱う。遷移先ホーム自身の時計と大会の時計を区別して破棄を確認する。ブラウザテストはAPIを全面的に置換したため、実際のDB連携・複数端末同期は反映後の確認事項として残る。

## 本番反映時の手順

本番へは今回まだ接続・反映しない。実施時は改めてユーザーの反映指示を受ける。

1. 本番のGit HEADと既存差分を確認する。修正前の基準は `f13406b2`。本番の `next/components/top/LimitedIdeas.js` の既存変更を保持し、今回の `index.js` の差分だけを反映対象とする。無関係なローカルのドキュメント・実験変更を一括投入しない。
2. 運営が現在プレイ／観戦中の人が０人であることを確認する。`tournament.participant_count` や `players.length` は登録参加者数であり、接続中人数ではない。現行実装にオンライン人数の確定APIはないため、これらを「アクティブ０人」の判定に使わない。
3. 単一Nextコンテナ方式ではビルド中にサイト停止が生じる。ユーザーが指定した静かな時間帯に、Nextのみを更新する。Laravel・scheduler・MySQL・Redisは停止しない。migration／Seederの実行は不要。
4. 既存方式を使う場合は、リポジトリルートで `docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --no-deps --force-recreate next`。本番overrideは `yarn build && exec yarn start` なので、コンテナrunningだけを完了判定にせず、ビルドとNext起動の完了、HTTP 200、ブラウザの約３秒間隔のstate取得を確認する。
5. 画面を開いたままの利用者には一度リロードしてもらう。旧JavaScriptには不具合が残る。複数ユーザーで状態同期を確認する。
6. ビルド失敗時は原因を確認して修正前の `index.js` へ戻し、Nextを再ビルド・起動する。既存の別ファイルの変更やDB進行状態は戻さない。masterへのmergeはしない。

並行プロセス＋Nginx切り替えによる無停止構成は別途調査済みだが、今回追加しない。既存方式を利用する限り、本番ビルド中のダウンタイムは解消しない。

ローカルビルドの成果物は本番サーバーへそのままコピーしない。本番Linux x64・本番環境設定でビルドし、DB接続・認証・静的資産も確認する。ローカルの検証成功は、資源量の異なる本番でのビルド時間やメモリ使用を保証するものではない。
