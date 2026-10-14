# Keywords Editorial

## 2026-10-14 検討開始

- ユーザーは keywords の大幅拡充を検討している。対象はピクミンシリーズの用語、キャラクター、ステージ、エリア、原生生物、回収物（パーツ・お宝・フルーツ）、ギミック、コミュニティミームなど。
- カテゴリごとの必須項目・必要なフォーマットはユーザーが指定する。
- まずカテゴリと記事の執筆状況を一覧管理し、少数記事の試作・改善を経て量産を検討する。
- ミーム以外は主に Pikipedia を参照して日本語記事を補完する構想。大量翻訳に先立ち利用条件・必要な帰属表示を確認する。現時点では未確認。
- 投入方法は Seeder または本番専用アカウントによる投稿を検討中。まだ方式決定・本番投入の指示はない。

## コード上の確認事項

- 本文表示は `next/components/modal/KeywordContent.js` の ReactMarkdown。
- `laravel/database/seeders/KeywordSeeder.php` は CSV を読み込み `Keyword::create` で追加する。重複防止・既存記事の保護は別途設計が必要。
- カテゴリ表示名は `next/locale/ja.js`、絞り込み一覧は `next/components/form/PullDownKeywordCategory.js`。`collection` は表示名定義にはあるが絞り込み一覧には含まれていない。

## 2026-10-14 参照元ライセンス調査

- 詳細と一次資料URLは `docs/keywords-source-licenses.md` を参照。
- Pikipedia 本文は原則 CC BY-SA 4.0（2024-10-18 19:48 UTC以前の投稿は3.0）。大量翻訳は単なる出典リンクだけでは不十分で、帰属・ライセンス・変更表示・継承条件が必要。
- Pikipedia AI policy は学習に加えAIへの入力も禁止と明記。Codexによる翻訳量産を当然に許可済みとして進めない。サイトの主張と法的な有効性は区別する。robots は一般botに1秒間隔指定で、AI許諾を意味しない。
- 画像は個別ライセンス。公式画像等のfair use表記をPik5への転載許諾と解釈しない。
- Pikmin TKB はCC BY-SA 4.0へのリンクを確認。GPTBot拒否。免責事項の無料配布要求と標準CCの商用利用許容に不整合があり要確認。
- TASVideos は本文CC BY 2.0。AI投稿規定あり。robots は60秒間隔、一部パス禁止。外部AI翻訳・学習の包括許諾は未確認。
- TCRF は403等により一次資料未確認。採用保留。
