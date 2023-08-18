import {KeywordContent} from "../../components/modal/KeywordContent";

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