# Keywords 参照元の利用条件調査

確認した範囲では、**Pikipedia の文章は条件付きで大量転載・翻訳できますが、URL の掲載だけでは不十分です。また、今回の「Codex に原文を読ませて記事を量産する」方式は、同サイトの AI ポリシーに抵触する扱いです。** 以下は2026年10月14日時点の公開規定の確認結果です。

**Pikipedia：本文の大量転載・日本語訳**

本文は原則 **CC BY-SA 4.0**。2024年10月18日19:48 UTCより前の投稿は CC BY-SA 3.0 とされています。[著作権規定](https://www.pikminwiki.com/Pikipedia:Copyrights)

CC ライセンスに基づく転載・翻訳には、分量の上限は設けられていません。商用利用も可能ですが、次の対応が必要です。

- 記事名、Pikipedia の寄稿者への帰属、原文へのリンクを表示する。原文の版・履歴も追える形にする。
- 適用ライセンス名とライセンスへのリンクを表示する。
- 日本語訳・要約・編集など、変更したことを明記する。
- 翻訳などの翻案物を、同じライセンスまたは認められた互換条件で公開する。

継承対象の範囲は再利用方法によりますが、Pik5 のコード全体を自動的に CC 化するという意味ではありません。翻訳記事部分の範囲と条件を明確にする設計が必要です。[CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/)、[ライセンス本文](https://creativecommons.org/licenses/by-sa/4.0/legalcode.en)

なお、著作権法上の「引用」に頼る場合は別です。**出典 URL があれば大量利用できるわけではなく**、引用目的、公正な慣行、正当な範囲などが必要です。原文の翻訳を記事の中心にする構想では、引用扱いよりライセンスに基づく転載・翻訳として設計するのが適切です。[CRIC の引用解説](https://www.cric.or.jp/qa/cs01/)

**Pikipedia：アイコン・画像**

**一括で流用可能とは判断できません。** 本文の CC ライセンスは、ゲーム由来のアイコンや画像すべてに適用されるものではありません。

Pikipedia は任天堂などの公式画像・ゲーム内画像を、主に米国法上の fair use として掲載しています。これは Pik5 への転載許諾ではなく、日本での掲載がそのまま認められる根拠にもなりません。[免責事項](https://www.pikminwiki.com/Pikipedia:General_disclaimer)

画像ごとにファイル説明ページで、権利者、出所、個別ライセンスを確認する必要があります。CC やパブリックドメインの画像はその条件で検討できますが、`fairuse`、ライセンス不明、独自制作画像はそれぞれ別判断です。**装飾・一覧表示のアイコンとして大量配置する用途を、当然に「引用」とは扱えません。** 今回は個別アイコンの選定・許諾確認までは行っていません。[画像ライセンスの種類](https://www.pikminwiki.com/Template:License)

**Pikipedia：AI・bot・学習制限**

- **AI ポリシー**：学習だけでなく、本文・画像等を AI モデルへ入力することも、私的・公的利用ともに禁止すると明記しています。原文を入力して翻訳・要約する今回の方式も、文言上その対象と読むのが自然です。
- **同サイトへの投稿**：AI 生成記事・画像の投稿も禁止。これは Pik5 への掲載規定とは区別が必要です。
- **robots.txt**：取得時点では一般 bot に `Crawl-delay: 1`。AI bot を名指しした全面拒否はありませんが、AI 利用の許諾を意味しません。

出典：[AI ポリシー](https://www.pikminwiki.com/Pikipedia:AI_policy)、[robots.txt](https://www.pikminwiki.com/robots.txt)

ただし、**「サイトが禁止を明記している」ことと「CC ライセンス上、AI 利用が常に違法になる」ことは同一ではありません。** Creative Commons は、追加のサイト利用条件と CC ライセンスを区別し、AI 利用には著作権の例外や各国法も関係すると説明しています。Pikipedia の法的見解を確定した結論としては扱えません。運用上は、大量処理を始める前に、出典表示付きの AI 翻訳・外部公開について明示的な了解を得る方針を勧めます。[CC の FAQ](https://creativecommons.org/faq/index.html)、[CC の AI 解説](https://creativecommons.org/2023/08/18/understanding-cc-licenses-and-generative-ai/)

**ほかの技術情報源（日本語非公式サイトは除外）**

| サイト | 技術情報・本文の再利用条件 | 画像・AI・自動アクセス |
|---|---|---|
| [Pikmin Technical Knowledge Base](https://pikmintkb.com/wiki/Main_Page) | ファイル形式、内部パラメータ、洞窟生成、セーブデータなど。フッターのリンク先は **CC BY-SA 4.0** | 公式画像等は主に fair use。確認した Policies には AI 専用禁止条項は見当たりませんでしたが、[robots.txt](https://pikmintkb.com/robots.txt) は **GPTBot を全面拒否**。AI 全般の許可とは判断できません。 |
| [TASVideos：Pikmin 2](https://tasvideos.org/GameResources/GC/Pikmin2) | 入力、移動速度、当たり判定、TAS 向け技術。サイト本文は **CC BY 2.0** で、適切な帰属表示による再利用が可能 | ゲーム画像の権利は別途確認が必要。[AI 規定](https://tasvideos.org/AIPolicy)はサイト内の AI 生成投稿を制限。確認した規定では外部での翻訳・学習に対する包括的な許諾・禁止は確認できません。[robots.txt](https://tasvideos.org/robots.txt) は **60秒間隔**と一部パスの巡回禁止。 |
| [The Cutting Room Floor](https://tcrf.net/Pikmin) | 未使用要素、デバッグ機能、地域・版の差異を調べる候補 | 今回は対象ページ・規約の取得が403等で失敗。本文ライセンス、画像、AI・bot 条件はいずれも一次資料による確認未了のため、採用保留。 |

TKB には注意点があります。免責事項に「派生コンテンツは無料でなければならない」という趣旨の説明があり、商用利用も認める標準 CC BY-SA 4.0 と整合しません。大量利用の前に、この記述と AI 翻訳の可否を運営へ確認する必要があります。[TKB ポリシー](https://pikmintkb.com/wiki/Pikmin_Technical_Knowledge_Base:Policies)、[免責事項](https://pikmintkb.com/wiki/Pikmin_Technical_Knowledge_Base:General_disclaimer)。TASVideos の本文ライセンスは[SiteLicense](https://tasvideos.org/SiteLicense)で確認しました。

今回の拡充では、**Pikipedia・TKB は AI 翻訳の扱いを確認してから採用し、画像は記事本文と分けて個別に権利管理する**構成が適しています。前の回答で挙げた Pikipedia を使った量産案には、この条件を追加する必要があります。
