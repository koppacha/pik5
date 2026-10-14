import {KeywordContent} from "../modal/KeywordContent"

export default function TricksManualContent({content}) {
    return <article data-tricks-manual style={{color: "var(--color-text-base)", overflowWrap: "anywhere"}}><KeywordContent readOnly users={[]} data={{keyword: "期間限定ランキング ユーザーマニュアル", content}} /></article>
}
