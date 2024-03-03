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
### 旧ピクチャレ大会（chr.mn/pik4）からのデータ引き継ぎ方法

**旧ピクチャレ大会ユーザーにはユーザーIDを自動付与したので、これを使ってください**

1. 旧ピクチャレ大会登録者は、このページの一覧にあるユーザー情報を使って新ピクチャレ大会にログインすることができます。
1. 必要な認証情報は、**ユーザーID＝このページに記載のID、パスワード＝旧ピクチャレ大会で使っていたパスワード**です。
1. 旧ピクチャレ大会でパスワードの紛失等により複数回の登録を行った方は、ユーザー名は最初に登録したもの、パスワードは最後に登録したものになっています。
1. 後日のアップデートでパスワードとユーザー名の変更機能を実装する予定です。変更希望者はしばらくお待ちください。
1. 2015年08月31日より前に登録し、2015年09月01日以降一度も投稿していないユーザーはロックがかかっています。管理人にお問い合わせください。
1. このリストに掲載されている情報は、ログインが確認されたユーザーから順次削除予定です。
1. パスワードを忘れた方やログインできない方はお手数ですがDiscord/Twitterで管理人宛にDMください。

#### ログインページへ→ https://pik5.net/auth/login

.
### 旧ピクチャレ大会登録者リスト

| 表示名        | ユーザーid           |
|------------------|-------------------|
| .74(ナナシ)       | nanashi74         |
| §マリルイ         | sectionmarilui    |
| AbsolutlyAsh     | AbsolutlyAsh      |
| Aeyerlock        | Aeyerlock         |
| Altair357        | Altair357         |
| Anthony          | Anthony           |
| AnthonyRF        | AnthonyRF         |
| ao1415           | ao1415            |
| APerson13        | APerson13         |
| chappy4321       | chappy4321        |
| ChasingJess      | ChasingJess       |
| Chemi            | Chemi             |
| chw              | chw               |
| Curtis           | Curtis            |
| CyanProphecy     | CyanProphecy      |
| dermas           | dermas            |
| DRAFIX           | DRAFIX            |
| Drought-Ender    | Drought-Ender     |
| FloorPann        | FloorPann         |
| flyinghawk       | flyinghawk        |
| Ghostly          | Ghostly           |
| Hagumi           | Hagumi            |
| HAPDAP           | HAPDAP            |
| HutabaNon        | HutabaNon         |
| ice_cube171      | ice_cube171       |
| identete         | identete          |
| iid01            | iid01             |
| Jacob2of3        | Jacob2of3         |
| Jay596           | Jay596            |
| Jer              | Jer               |
| JHawk4           | JHawk4            |
| Jkob             | Jkob              |
| Johannes         | Johannes          |
| Johnson          | Johnson           |
| K                | K                 |
| Kap              | Kap               |
| kari             | kari              |
| kath_nanaya      | kath_nanaya       |
| kazu8            | kazu8             |
| LPhantom         | LPhantom          |
| Lusonice2021     | Lusonice2021      |
| mayka            | mayka             |
| mercysnow        | mercysnow         |
| messhi475        | messhi475         |
| Moony            | Moony             |
| Mourning         | Mourning          |
| MrAracn          | MrAracn           |
| muratsubo        | muratsubo         |
| Myelin_sr        | Myelin_sr         |
| naza             | naza              |
| nuinuisousou     | nuinuisousou      |
| perryii          | perryii           |
| pikitto          | pikitto           |
| Pikleaf          | Pikleaf           |
| pikumin3         | pikumin3          |
| Plata            | Plata             |
| PlataGG          | PlataGG           |
| Raytreau         | Raytreau          |
| Red_sheep        | Red_sheep         |
| Redpik           | Redpik            |
| Refu             | Refu              |
| RexMcPwn         | RexMcPwn          |
| Rirure           | Rirure            |
| Ruri             | Ruri              |
| Ruri＆Vincent     | Ruri_Vincent      |
| Santa            | Santa             |
| Sbudiver         | Sbudiver          |
| sdsg             | sdsg              |
| SHINYA           | SHINYA            |
| shizei3          | shizei3           |
| Spidman          | Spidman           |
| TEL              | TEL               |
| TheRealBobby0    | TheRealBobby0     |
| TimPannekoek     | TimPannekoek      |
| TRR              | TRR               |
| U3               | U3                |
| UltimD           | UltimD            |
| Vincent          | Vincent           |
| Vincent＆Ruri     | tfgwmn            |
| VivaReverie      | VivaReverie       |
| wasimi           | wasimi            |
| WaterFall        | WaterFall         |
| Y-Tendoo         | Y-Tendoo          |
| Y-TeNdoo404      | Y-TeNdoo404       |
| yamany           | yamany            |
| Yellowishpik     | Yellowishpik      |
| yukidaruma       | yukidaruma        |
| ZeldaCrasher     | ZeldaCrasher      |
| Zenyat           | Zenyat            |
| ZEOKU            | ZEOKU             |
| Zeps             | Zeps              |
| アーキー          | arukii            |
| アカピク♪         | akapiku           |
| アキサメ          | akisame           |
| あぐにゃん         | pik_Agnyan        |
| アクロリ          | akurori           |
| あごすけ          | agosuke           |
| あひる            | ahiru             |
| アレイク          | areiku            |
| いきもの          | ikimono334        |
| イシヘビガラス     | ishihebigarasu    |
| いっき            | ling_pik_ikki     |
| いぬくち          | inukuchi          |
| イメディン         | imedin0813        |
| エープリル        | April_lapispik    |
| エス              | esu               |
| えなげん          | enagem_akakuy     |
| えるヴぉれ         | eruvoore          |
| カッキーズ         | kakkizu           |
| ガッチ            | gatchi            |
| カツン            | katsun            |
| かにちゃん        | kanichan          |
| かほ              | kaho              |
| ガラパゴス        | garapagosu        |
| きっす            | kissu             |
| クシ              | kushi             |
| クマチャッピーに似てるな | kumachappiniteruna |
| くらげ            | kurage            |
| コアラ            | koara             |
| サクレカマドフマ     | ToolAssistedPik   |
| さざんか           | sazanka           |
| サンド             | sando             |
| シノウちゃん        | shinouchan        |
| しよ               | C4_child35        |
| ジョニヮ           | jonijoni_123      |
| スコティッシュフィールド | scottish-fold   |
| スナドリネコ        | sunadorineko      |
| スフィーダ          | sufida            |
| スマ               | suma              |
| すもももも         | sumomomo          |
| スラスラ           | surasura          |
| セレン             | Selenium_pikmin   |
| ただのピクミン好き   | tadano-pikuminzuki |
| だっつ             | dattsu            |
| だよみん           | dayomin           |
| チャッピーピクミン   | chappi-pikumin    |
| つの               | tsuno             |
| テオナ             | teona             |
| デメマダラダケ     | dememadaradake    |
| でんしゃマニア     | denshamania       |
| トウキョウマルイネズミ | tokyo-maruinezumi |
| トマトリョーシカ   | tomatopikumin     |
| とろろ            | tororo            |
| とんがりまさお     | tongarimasao      |
| なかたつ           | nakatatsu         |
| なぎさ             | nagisa            |
| なしれし           | nashirechi        |
| なすび             | nasubi            |
| なんとか           | nantoka           |
| にこしゅう         | nikoshu_pik       |
| はたけ             | hatake            |
| バライト           | ba_ryte           |
| パラレル           | parareru          |
| パレット           | paretto           |
| ピーチBOY          | piichiboy         |
| ピクナー           | pikuna            |
| ピクミンヤクザ     | pikmin893         |
| ピッチョン         | pitchon           |
| ふきふふき          | fukifufuki        |
| プラタ             | PlataSmash        |
| フローズン         | furoozun          |
| ぷん               | pun               |
| ほこがまえ         | hokogamae         |
| ポン               | pon               |
| ポンポン           | ponpon            |
| マカハラ           | makahara          |
| まちだ             | machida           |
| マラモン           | maramon           |
| みら～じゅ         | miraaju           |
| ミラン             | miran             |
| め                 | me                |
| メケメケサンバ     | mekemekesamba     |
| メザシ            | mezasi_pikmin     |
| ゆいびっち         | yuibitchi         |
| ユーリ【U-D】      | yuuriud           |
| ゆどうふ           | yudoufu           |
| ゆんける           | yuyuyunkel        |
| ライジング-rising- | rising            |
| りゅうん           | ryuun             |
| リンドウ           | rindou            |
| るすと             | rusuto            |
| れいる             | pikminnotoko      |
| れふ               | refupikumin       |
| ろいPKMN           | roipkmn           |
| ローラーが無いアメボウズ | roora-ganaiamebouzu |
| わたぬき           | shiragawatanuki   |
| わち               | wachi             |
| 黄金オリマー       | koganeorima       |
| 乙がいあ           | otsugaia          |
| 乙丸大五郎         | YT7GyX7X6SN2S8v   |
| 高野原ちぢみ       | Tizimi77777       |
| 黒木葉             | 96_Leaf           |
| 骨スト奥目         | hone-sutookume    |
| 侍魂               | samuraitamashi    |
| 次亜塩素酸ナトリウム | jiaenosanshunatoriumu |
| 紗波               | sanami            |
| 新屋               | shinya_           |
| 森の中             | morinonaka        |
| 親子               | oyako             |
| 須磨穂産磁化鳥     | sumahojinazukatori |
| 成夏ローグ         | makalogue         |
| 星屑               | HoshiKUZU_pik    |
| 赤ピク             | akapiku           |
| 大輝               | daiki             |
| 超燃料ダイナモ     | chounenryoudainamo |
| 超砲撃マシンダマグモキャノン | chouhougekinamashindamagumokyanon |
| 鉄               | FeTellYou         |
| 湯ゆっくり         | yuyukkuri         |
| 匿名希望           | tokumeikibou      |
| 軟質重金属の内臓   | nanshitsujuukinzounaizou |
| 白角えす           | shirokaku-esu     |
| 姫               | xxHIMExx          |
| 不時着             | fuji_luck         |
| 普通の人間         | futsuunoningen    |
| 抹茶               | matcha            |
| 木村咲             | earaxm            |
| φ                | PKtoyama          |

#### ログインページへ→ https://pik5.net/auth/login
`

const data = {
    unique_id: "moving",
    flag: 1,
    category: "terms",
    keyword: "データ引き継ぎガイド",
    tag: "編集保護",
    yomi: "でーたひきつぎがいど",
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