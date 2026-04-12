import {KeywordContent} from "../../components/modal/KeywordContent";
import SeoHead from "../../components/SeoHead"

export async function getServerSideProps(context){
    const { getCachedUsers } = await import("../../lib/usersCache")

    // スクリーンネームをリクエスト（検索用）
    const users = await getCachedUsers()

    return {
        props: {
            users
        }
    }
}

const content = `

`

const data = {
    unique_id: "update",
    flag: 1,
    category: "other",
    keyword: "更新履歴",
    tag: "編集保護",
    yomi: "こうしんりれき",
    first_editor: "koppacha",
    last_editor: "koppacha",
    content: content
}

function Rules(){
    return (
        <>
            <SeoHead
                title={"更新履歴 - ピクチャレ大会"}
                noindex={true}
            />
            <KeywordContent data={data}/>
        </>
    )
}

export default Rules
