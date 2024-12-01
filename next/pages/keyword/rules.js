import {KeywordContent} from "../../components/modal/KeywordContent";
import prisma from "../../lib/prisma";

export async function getServerSideProps(context){

    // スクリーンネームをリクエスト（検索用）
    const users = await prisma.user.findMany({
        select: {
            userId: true,
            name: true
        }
    })

    return {
        props: {
            users
        }
    }
}

const content = `
### 第１条（目的）
1. 本規約は、ピクチャレ大会の円滑な運営、ランキング等のコンテンツの公平性の維持のために、運営者およびユーザーそれぞれの権利と義務を定めます。
1. https://pik5.net/keyword/rules に掲載されているすべての文書は本規約を構成します。
1. 前項に加えて、本規約が指定する文書もユーザーが守るべきルールとして扱います。これには各ランキングのレギュレーション等が含まれます。
1. 本規約外における取り決めと本規約の内容が矛盾する場合は、原則として本規約の取り決めを優先します。ただし管理人が特例を認める場合はこの限りではありません。
1. 当サイトは任天堂株式会社の著作物を利用したサービスです。当サイトは非公式であり、任天堂株式会社から個別に認定を受けたものではありません。これは各イベントについても同様です。

### 第２条（定義）

本規約における主な定義について以下の通り定めます。

1. 「当サイト」とは、https://pik5.net ドメイン以下すべてのページを指します。
1. 「コンテンツ」とは、当サイトに保管されるすべてのデータを指します。外部APIによって取得されたデータはこれに含みません。
1. 「管理人」とは、こっぱちゃ（@koppachappy）を指します。管理人がユーザーと同じ利用方法で当サイトを利用するかぎり、管理人はユーザーでもあります。
1. 「ユーザー」とは、当サイトを閲覧、登録、投稿、または当サイトが管轄するピクミン界隈Discordサーバー内に参加するユーザーを指します。そのうちランキングに投稿するユーザーを「プレイヤー」と呼びます。
1. 「ピクミン界隈」とは、主に当サイトを利用したことがあり、Twitter上で相互交流しているプレイヤーの集まりであり、管理人を含みます。
1. 「ユーザーコンテンツ」とは、ユーザーが当サイトに投稿し、当サイトや管理人がアカウントを所有する連携先のサーバーに保持されている情報データのうち、
   スクリーンネーム、証拠写真（画像ファイル）、コメント、キーワードの編集内容など原則として権利がユーザーに帰属するデータが該当します。ここにはゲームのスコアは含まれません。
1. 「スコア情報」とは、ユーザーが当サイトに投稿したゲームのスコアやそれに付随する情報を指します。
   スコアそのもの、ユーザーID、投稿日時、操作方法、リージョンなどのプレイ情報が該当します。これらを削除・編集する権利は投稿成功時点で投稿者ではなく**管理人に帰属**します。
   したがって、ユーザーは一度投稿した記録は特例を除いて自己都合による削除は認められません。
1. 「基本レギュレーション」とは、本規約に含まれるゲームをプレイするにあたって守るべきルール全体を指します。各カテゴリやステージの「レギュレーション」は、個別ルールとこの基本レギュレーションを足し合わせた部分を範囲とします。
1. 「迷惑行為」「公序良俗に反する行為」「道徳に悖る行為」等のモラルに関する規定において、どのような行為がそれに該当するかどうかは個々のケースごとに管理人の判断によって決定します。
1. 「イベント」とは、期間限定ランキングやボイスチャンネルを利用した１日限りのオンラインイベント、またはオフラインイベントを指します。

### 第３条（参加条件）

1. 当サイトは、反社会的な主張をしている者や、ピクミンシリーズ、管理人、ピクミン界隈全体のいずれかに対するいわゆるアンチとして活動している者は利用することができません。
1. 当サイトは、過去にピクミン界隈の一部または全部に対して著しい迷惑をかけた者（永久出禁対象者）は原則として利用することができません。永久出禁対象者リストはいかなる理由があっても公表しません。
1. 当サイトは、過去に不正投稿を疑われ、潔白証明ができていない者は利用することはできません。
1. その他、管理人が利用をお断りすることが妥当と判断した者については、利用を拒否することがあります。

### 第４条（免責事項）

1. 管理人は、当サイトの運営に関する操作や活動等によりユーザーに不利益や損害を与えたとしても、原則として責任を追わないものとします。
   同様に、当サイトに関連したユーザーの操作や活動等により発生した不利益や損害についても同様とします。
   たとえば、パスワードの使い回しや流出によるセキュリティ・インシデントはこの範疇です。
2. 前項の例外として、管理人の重大な過失により管理人が責任を負うことが妥当であると客観的に判断できる場合はこのかぎりではありません。

### 第５条（ルール規定）

1. 当サイトにおいて、各ランキングに投稿するにあたり守るべきルールについては、ステージ別ページにリンクされているレギュレーションのページに記載します。
   ここでレギュレーションページとはルールIDが10なら https://pik5.net/keyword/10 のように対応したノートページを指します。
   各プレイヤーは投稿するにあたり、このレギュレーションを十分に理解する義務があります。レギュレーションに同意できない場合、または理解できない場合は投稿することはできません。
1. レギュレーションはいつ更新されても、常に最新版が対象ステージのスコアすべてに適用されます。
   最新レギュレーションに違反している過去のスコアは削除される場合があります。
1. レギュレーションは管理人によってのみ作られるものではなく、プレイヤー全員によってより良くしていくものです。
   よって、ユーザーはレギュレーションに対していつでも議論できる権利があり、それを踏まえてユーザーが改訂が必要であると判断した場合、管理人が特に認めた者であれば誰でもレギュレーションを改訂できます。
1. 前項の例外として日本語以外の言語を話す者の意見など、特別な事情によって特定ユーザーの意見を汲み取ることが困難な場合、管理人およびユーザーはそれを必ずしも聞き入れる義務を有しません。

### 第６条（基本レギュレーション）

#### 基本レギュレーションに関する細則

1. 本条はあらゆるレギュレーションの基礎として、ピクチャレ大会へ投稿する記録のプレイングに対して守られるべき方針を構成します。
1. レギュレーションに違反することと利用規約に違反することは別の問題であり、レギュレーション違反をしたからといって規約に反したことにはなりません。
   レギュレーションの違反が起きた場合、原則として当該記録を削除することでそれを解決し、ペナルティ等は残りません。
1. 管理人の個別裁定は基本レギュレーションより優先します。
1. 基本レギュレーションと個別レギュレーションで矛盾する場合、個別レギュレーションを優先します。

#### 基本レギュレーション

1. 使用するゲーム機は純正の未改造品でなければなりません。
1. 使用するゲームソフトは公式のディスク版かダウンロード版に限り、非公式のバッチが適用されたものは認められません。
1. 使用するコントローラーは純正か公式ライセンス品に限ります。ただし、連射機を搭載している場合、連射機の使用は認められません。
1. 証拠動画のビットレート等について制限はありませんが、第三者による視聴が困難である場合はそれを証拠動画として認めません。
1. 各レギュレーションで特に認められた場合を除き、すべてのランキングで投稿時点で１位になることが見込まれるスコアには証拠動画が必要です。
   ただし以下に定める特例に該当する場合は免除される場合があります。
1. 証拠画像はリザルト画面全体を撮ることを原則とし、スコアや必要な情報の一部が確認できない場合はそれを証拠画像として認めません。
1. 何らかの事情によりリザルト画面の証拠画像提出が不可能な場合にかぎり、ハイスコアが表示されているステージセレクト画面を代替として提出することが認められます。

#### 基本レギュレーションの特例

基本レギュレーション第５項に定める証拠動画提出の義務では、不本意な形で証拠動画を提出できない場合、以下の条件を満たす場合に提出を免除します。

1. ピクミン界隈のコミュニティに長期かつ積極的に参加しており、不正が疑われたことがないこと。
1. 証拠動画必要スコアを獲得するに足る実力を持っていると複数の第三者に認識されていること。
1. 当該記録の証拠動画未提出はあくまでも不本意であり、今後は必要な場合に証拠動画を提出する意思があること。

### 第７条（基本理念と努力義務）

1. 当サイトはレトロゲームも扱うスコアランキングという性質上、証拠画像や証拠動画の偽造は容易です。
   ルールを逸脱した不正投稿には価値が無いという前提のもと、ある程度ユーザーの善意に依存した運営がされており、
   悪意あるユーザーの出現によって簡単にコミュニティが崩壊しうるリスクを抱えています。
   すべてのユーザーは、ランキングが信用されるためにはコミュニティ内で不正を許さない風潮が必要であることを認識し、その維持に努めてください。
1. すべてのユーザーが豊かに活動するための実践方針として、当サイトでは[相互承認の基本理念](./168ee2d5ed0fe)を掲げ、ユーザーに実践を促すこととします。
1. 本条の第１項および第２項は努力義務であり、実践できなかったとしてもペナルティはありません。


### 第８条（禁止事項）

当サイトではユーザーの禁止行為について本条の通り定め、ユーザーは利用規約に同意した時点ですべての禁止事項を犯さないことを約束したものとみなします。
管理人および管理人により委任された者は、これに違反した者を第９条の規定により処分できるものとします。

#### A　ユーザー登録

1. 当サイトでは、同一人物による複数アカウントの登録は認めません。
1. 当サイトでは、アカウントの譲渡、貸し借り、売買、またはユーザー情報の一部を他人の指示によって変更することは認めません。
1. 当サイトでは、ユーザースコアの存在が参加者全体のランクポイントに影響することを考慮し、原則として**アカウントの削除はできません**。
1. 当サイトは、実名での登録は本人が特に希望する場合を除いて認めていません。
1. 当サイトでは、登録者本人ではない他者（実在する人物や架空のキャラクターなど）を直接的に想起させるようなスクリーンネームやユーザーIDの登録やなりすまし行為は禁止します。
1. 当サイトでは、特定商品の宣伝やスパム、アフィリエイトなどを目的とするスクリーンネーム、ユーザー名の登録は禁止します。

#### B　投稿

1. 当サイトでは、スコア情報を偽って投稿することはその内容や程度にかかわらず絶対に禁止します。
   ただし不可抗力による投稿ミスの場合、すみやかに管理人に報告するか削除機能で削除すれことによって違反状態を投稿前まで遡って免除するものとします。
1. 前項に加えて、証拠画像の偽装行為（位置情報、撮影日などを意図的に変更する行為等）は絶対に禁止します。
1. 当サイトへのスコア投稿は、ステージ別に定められたレギュレーション、および各種ガイドラインに準拠していなければならず、それに違反した投稿をすることはできません。
   特に改造ROMや改造本体を用いた記録を通常ランキングへ投稿することは絶対に禁止します。ただしレギュレーションの更新により過去の投稿が違反対象となった場合等、投稿者が意図しない違反は本項の対象外とします。
1. 最新集計年ランキングに掲載されている記録は、投稿時点で公開設定にしていた証拠動画を、投稿後に動画サイド側で非公開にする行為は認めません。
1. 当サイトでは、当サイトの主旨を逸脱するような投稿、プロモーションコードの記載やアフィリエイトリンクなど一部の人が一方的に利するような投稿はできません。
1. 当サイトでは、公序良俗に反する投稿・発言は認めません。
1. 当サイトでは、恫喝、脅迫、誹謗中傷、名誉毀損等、特定または全体の他ユーザー（管理人含む。以下同様）を貶めたり屈辱を与えるような一切の投稿・発言を禁止します。
1. 当サイトでは、年齢、出自、社会的地位、国籍、性別、趣味嗜好、性的指向などを根拠に特定の人を貶めたり、差別したり、あるいは自尊心を傷つけるような投稿・発言は認めません。
1. 当サイトでは、時事問題、男女交際、政治的主張、宗教的主張、ゴシップなど、立場の違いによって論争の元になりやすいような内容の投稿・発言は認めません。

#### C　サイトの利用

1. 当サイトに対するハッキング行為などの不正アクセスや、DDoS攻撃などサーバーに負荷を与える行為は絶対に禁止します。
1. 当サイトに対して、通信を偽装して不正なリクエストを送信する行為は絶対に禁止します。
1. 当サイトに対するスクレイピング行為やツールを用いたデータリクエストは認めていません。
1. 当サイトにおいて更新ボタンやサイト内に設置してあるボタンを必要以上に連打する行為は禁止しています。
1. その他、当サイトにおいて他のプレイヤーや管理人、サーバーホスティング業者、ドメイン管理者に迷惑がかかる行為は禁止します。
1. 当サイトの存続中に、ユーザーが当サイトとは別に類似のサービスを展開することは認めていません。
1. ユーザー本人に権利が帰属しない情報は、転載などの二次利用を認めていません。ただし他のユーザーに権利が帰属する情報は、当該ユーザーの許可を得ているかぎり本項の対象外とします。

#### D　SNSの利用

1. SNS等（Twitterなどのマイクロブログや匿名掲示板、動画サイトなどを含むネットコミュニティ全般。以下同様）において、
   当サイトやピクミンシリーズに対するヘイト投稿やネガティブキャンペーン、
   管理人や登録ユーザーに対する誹謗中傷や名誉毀損など自尊心を傷つけるような攻撃行為は禁止します。
1. SNS等における管理人や特定ユーザーのなりすまし行為は禁止します。
1. 当サイトに紐づいたSNS等のアカウントを用いて反社会的な活動や著しく倫理に悖る投稿を行うことは認めていません。
1. 当サイトのコンテンツのうち、一般公開されていない情報を管理人の許可を得ずにSNS等に掲載することは絶対に禁止します。

#### E Discord「ピクミン界隈」の利用

1. ピクミン界隈Discord（以下、当Discord）の交流においては、すべてのユーザーに対し、常に他者を尊重し、配慮し、ほどよい距離感を意識した態度で臨むことを求めます。
1. Discordを異性との出会いや友達作り、またはコミュニティ空間の私物化やそれに類する行為を目的として利用することを禁止します。
1. 公序良俗に反する内容・発言（ボイスチャット含む）等、本条の「B 投稿」第５項以降に定める禁止事項の一切はDiscordでも禁止します。
1. Discordにおいて、ピクミン以外のゲームを主体としたイベントを開催することは原則として禁止します。
1. Discordにおいて、その場の参加者に求められていない形での自分語り（リアルにおける社会的ステータスをひけらかす等の行為）は認めていません。
1. Discordのボイスチャンネルでは、オフトピックチャンネルを除き、特にその場の参加者全員に求められている状況でないかぎり、ピクミンシリーズ以外のゲーム配信は認めていません。

#### E　その他

1. 前項までに掲げた禁止事項以外にも、管理人が違反行為として妥当であると判断した行為を違反行為とみなす場合があります。

### 第９条（違反者に対する措置）

前条の禁止事項を犯した者は、管理人または管理人が委任した者によって以下のようなペナルティを課すことがあります。
各禁止事項の文末はペナルティの重さの目安を示しています。（「認めていません」＜「禁止します」＜「絶対に禁止します」）

1. アカウントの永久ロック。（これが適用された時点でユーザーコンテンツのすべての権利は没収され管理人に帰属します）。
1. 投稿機能の一時的あるいは永久的なロック。
1. 特定のIPアドレスやホストに対するアクセス禁止措置。
1. 期間限定ランキングなどのイベントへの一時的あるいは永久的な参加権剥奪。
1. SNS等のアカウントとの紐付け解除。
1. 投稿された内容の差し戻し、修正、削除など。

これは、対象やその内容が明確でなくとも、客観的にその違反が強く疑われるかぎり、管理人または管理人が委任した者の判断によって任意の対象に対して発動できるものとします。
その場合、違反者は話し合いによってこれに異議を唱えることができます。
上記の他、日本の法律を犯している場合など悪質な場合は管理人の独断で警察や弁護士に相談するなどの措置をとります。

- また、特にユーザースコアの虚偽報告に関しては別途当サイト内に定める「潔白証明ガイドライン」によって無実を証明できるものとします。
  違反を疑われた者の自己都合によってこのガイドラインの施行が困難な場合、管理人は一方的に虚偽か否かの判断ができるものとします。
- 重大な虚偽報告をした者やピクミン界隈コミュニティに多大な迷惑をかけた者は相応に反省の意思がないかぎり永久出禁とします。

### 第10条（サービスの存続）

1. 管理人は当サイトの提供終了および第三者への運営権譲渡に関する単独決定権を持ちます。ユーザーはこれに異議を申し立てることはできません。
1. 特に以下に定める条項によって管理人がサービスの存続が困難であると判断した場合、管理人はサービスの一時停止または永続停止を決定することがあります。

    1. 日本国内において大きな災害が発生し、運営が困難になった場合。
    1. 当サイトをホスティングするVPSサービスにおいて障害が発生し、サービスの提供が困難になった場合。
    1. 重大なセキュリティ・インシデントが発生した場合。
    1. 特定のユーザー、または第三者、または不特定多数などによってサービスの運営を妨害され、対処が困難な場合。
    1. 権利元、ホスティングサービス提供者、その他当サイトにかかわる権利を保有する権利者からサービスの差し止めを要求され、管理人がこれを承諾した場合。
    1. 管理人の身元上のトラブルにより運営が困難になった場合。
    1. 管理人が認知するピクミンコミュニティが衰退または変化し、当サイトを存続する意義が薄れたと判断できる場合。
    1. その他、管理人がやむを得ずサービス停止する必要があると判断した場合。

### 第11条（共同開発規定）

1. ユーザーまたは第三者が当サイトの開発への参加を希望し、管理人がそれを認める場合、当該ユーザーを「共同開発者」と定義し、本条に定める越権行為を認めることがあります。
1. 共同開発者は常に公平にユーザーの情報を扱う義務を有します。特定のユーザーを有利にするために内部干渉する行為は認められません。
1. 共同開発者であっても、プレイヤーとしてレギュレーション上の越権は認められません。
1. 共同開発者のみによって作成したリポジトリの権利は作成者本人に帰属します。
1. ピクチャレ大会開発リポジトリ（koppacha/pik5）へコミットされたコードの著作権は管理人に帰属します。
1. 共同開発者は、当サイトのリポジトリに関与する場合、バージョン管理システムによって自分がどこを修正したかを明示する義務があります。バージョン管理システムはgithub.comを使用します。
1. 共同開発者であっても、当サイトのリポジトリのうちマスターブランチについては直接操作する権利を持ちません。ただし例外的に管理人が権利を付与する場合があります。
1. 管理人は共同開発者に対して、本来管理人しかアクセスできない情報へのアクセスを許可する場合があります。共同開発者はそこで得た秘密を外部に漏らしてはなりません。
1. 特定の共同開発者が共同開発者として不適切な行為や言動をした場合、ユーザーや管理人は当該ユーザーの共同開発者としての特権をいつでもはく奪する権利があります。
1. 第９条に定めるサービスの提供終了・一時停止・譲渡等が発生した場合、共同開発者は原則として管理人に異議を唱えることはできませんが、管理人は個々の損害が最小限となるように話し合いに応じる義務を有します。

### 第12条（プライバシー）

1. 管理人は、本サイトの運営によって知り得たユーザーの秘匿情報を厳密に管理し、それを公開することがないように務める義務を負います。
1. 前項の例外として、ユーザーの不正行為や犯罪などによって警察やプロバイダーから情報開示を請求された場合は特定のユーザーの秘匿情報を提供することがあります。
1. 本サイトはCookieを利用しています。本サイトは利便性向上を目的としてCookieを操作することがあり、ユーザーはそれに同意する必要があります。
1. 本サイトは利便性向上のためにユーザーのIPアドレスなどアクセス情報を収集することがあります。管理人はこれを個別に公開することはできませんが、各情報を特定できない形で解析結果を公開することはできるものとします。
1. 本サイトは広告の適切な表示のために、Google社およびその提携先に対してユーザーのアクセス情報を提供することがあります。
1. 本規約において発生する管理人の秘匿義務は、第９条の定めによって第三者にサービス運営権を譲渡する場合、譲渡先に対してのみ例外的に適用されないものとします。
1. その他、プロモーション活動やコラボレーション等のビジネス上の必要性に迫られて個人情報の取扱が必要になった場合は、管理人は事案ごとにプライバシーの公開範囲をお知らせするものとします。

### 第13条（本規約の変更）

1. 本規約が変更された場合は、 https://pik5.net/keyword/rules に反映され、反映が確認されたことをもって発効します。
   ユーザーは利用しているかぎり、利用時点で最新の規約に同意したものとみなします。
1. ユーザーはある時点での差分を閲覧する権利があり、その達成のために管理人は利用規約全文とその差分のすべてを[Githubの特定ディレクトリ](https://github.com/koppacha/pik5/commits/master/next/pages/keyword/rules.js)に公開する義務を負います。

### 第14条（イベント）
1. 当サイトで開催されるイベント（期間限定ランキングなどの一時的なランキング大会、コミュニケーションツールや配信サイトを用いた短期的なイベント）は任天堂の協賛・提携を受けたものではありません。
1. 当サイトで開催されるイベントには、任天堂が定める「[コミュニティ大会への出場および観戦に関する規約](https://www.nintendo.co.jp/tournament_guideline/rules.html)」が適用されます。
1. また、上記とは別にイベントごとに管理人がガイドラインを定める場合もあります。参加者（主催者、参加者、観覧者）はいずれの規約も順守しなければなりません。
1. 原則として、リアルタイム系のイベントは参加表明をした場合、それに時間通り出場する義務が生じます。無断欠場や事前報告なしで60分以上の遅刻を２回以上行った場合、以後のイベントには参加できません。

### 第15条（準拠法および管轄裁判所）

1. 本規約は日本国の法律を準拠法とします。
   また、本規約および本サイトに関する一切の紛争については、東京地方裁判所を第一審の専属的合意管轄裁判所とします。

`

const data = {
    unique_id: "rules",
    flag: 1,
    category: "terms",
    keyword: "利用規約・ルール集",
    tag: "編集保護",
    yomi: "りようきやく・るーるしゅう",
    first_editor: "koppacha",
    last_editor: "koppacha",
    content: content
}

function Rules(){
    return (
        <>
            <KeywordContent data={data}/>
        </>
    )
}

export default Rules