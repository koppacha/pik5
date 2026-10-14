import Head from "next/head"
import TricksManualContent from "../../components/tricks/TricksManualContent"

export default function TricksManualPage({content}) {
    return <>
        <Head><title>期間限定ランキング ユーザーマニュアル</title></Head>
        <main style={{maxWidth: 900, margin: "24px auto", padding: 16}}><TricksManualContent content={content} /></main>
    </>
}

export async function getStaticProps() {
    const {readFile} = await import("fs/promises")
    const content = await readFile(`${process.cwd()}/pages/keyword/tricks-manual.md`, "utf8")
    return {props: {content}}
}
