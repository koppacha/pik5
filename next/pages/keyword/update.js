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
            <KeywordContent data={data}/>
        </>
    )
}

export default Rules