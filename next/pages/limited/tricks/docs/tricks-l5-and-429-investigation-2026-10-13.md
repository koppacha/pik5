# L5フレームの初期表示と429の調査

記録日時：2026-10-13 01:36:35 JST
本番リビジョン：20d2822e

## ユーザー指示サマリー

本番でイベントページへ遷移した直後、最終リザルトのL5フレームが正常表示されないことがある問題と、遷移時に429が出る問題を調査する。

## 調査結果

再現したケースでは共通原因がある。L5フレームのSVGとユーザーAPIがnginxの同じレート制限を受け、SVGの一部を取得できなくなる。カードの4レイヤーDOMとobserverのactive状態は正常で、欠けたレイヤーは画像取得失敗による。

### 本番再現

- 匿名Playwrightで直アクセス：liquid-spectrum-v6.svg、filaments-v6.svgともHTTP200、4レイヤーあり、active=true。
- トップを表示して1秒後にイベントへ遷移：/api/usersが429、/limited/tricks/rarity-legendary-filaments-v6.svgが429（Content-Type:text/html）。同じ時のliquid-spectrumは304、ブラウザPerformanceResourceTimingでは200（再検証されたキャッシュ利用）。
- 上記の失敗時もL5のDOMは4レイヤー・active=true。フレームの光の筋レイヤーが画像を取得できない。liquid-spectrumの取得も失敗する場合は3レイヤーが同じ画像に依存するため、さらに大きく欠けると考えられる（今回の実測はfilamentsのみ失敗）。
- 11秒待ってもSVG再取得0回。制限枠が回復しても、CSS background-imageにリトライ処理がないため画像はそのページ内では戻らない。
- ページ再読み込み後は両SVGとも200に回復。observerはobserved=21、eligible=5、visibility listener=1。

### 設定・実装の根拠

- /etc/nginx/nginx.confのperipは2r/s、limit_req_status=429。
- /etc/nginx/sites-enabled/pik5.confのlocation /はperip・burst=20・nodelay。通常API・ページ・/limited/tricks/の画像が同じ枠を使う。/_next/static/と/_next/data/のみ別の50r/s枠。
- L5 SVGはCache-Control:public,max-age=0。ファイル名にv6があるが長期キャッシュ設定はなく、遷移で再検証される。304もnginxのリクエスト制限枠を使う。
- next/components/tricks/TricksCardBorder.jsはCSS background-imageとして2つのSVGを参照。失敗通知・再取得の処理はない。カード背景の黄色がフォールバックになる。
- 追補（横断検査で訂正）：Laravelの名前付きapiには60件/分の定義があるが、実際の本番ルートはthrottle:1800,1であり、この定義は未接続。ただし、今回の429はAPIを経由しない静的SVGにも出ておりHTMLエラーページが返るため、再現したケースは手前のnginx制限による。Next middlewareは/api/auth-testのみが対象で、静的SVGへの429処理はない。
- nginx error.logの直近2MBから制限警告は抽出できなかった。limit_req_log_levelはwarnだがerror_logにレベル指定がなく既定errorのため、ログ未出力が整合する。判定は設定・ブラウザの実通信・回復確認に基づく。

## 推奨する修正

1. L5画像などの静的アセットを通常APIの低い制限枠から分離する。全APIの制限撤去ではなく、配信種別ごとの制限にする。
2. バージョン付きフレーム画像へ長期キャッシュを設定し、通常の再訪時に再検証が不要になるようにする。
3. 読み取りAPIの制限・burstをトップからイベントへ遷移する実際の初期要求数に合わせる。トップの初期要求も同じIP枠を消費することを考慮する。
4. 必要なら画像取得失敗時の回数制限付き再試行を加える。これは表示復旧用で、制限枠の分離・キャッシュが根本対策。

## 実施範囲

調査のみ。アプリ・nginx設定・DB・本番Gitを変更していない。負荷試験は行わず、通常のページ表示・遷移・再読み込みで再現した。ログは認証情報・Cookie・IP・本文を出力せず、制限ゾーン・時刻・パスだけを抽出した。確認画像はルートoutput/playwright/tricks-initial-load-audit-20261013.png、tricks-border-recovered-20261013.png。
