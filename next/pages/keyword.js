import Record from "../components/Record";
import {Box, Typography} from "@mui/material";
import FormDialog from "../components/FromDialog";
import {useRouter} from "next/router";
import {useSSR} from "@react-libraries/use-ssr";
import KeywordPost from "../components/KeywordPost";

export async function getServerSideProps(){

    // 記録をリクエスト
    const res = await fetch(`http://laravel:8000/api/keyword`)
    const data = await res.json()

    return {
        props: {
            data
        }
    }
}

export default function Keyword(props){

    return (
        <>
            <Typography variant="h5" sx={{
                fontFamily: ['"M PLUS 1 CODE"'].join(","),
            }}>ピクミンキーワード</Typography>
            <Box sx={{
                border:'1px solid #fff',
                padding: '2em',
                margin: '2em',
                borderRadius: '8px',
            }}>
            ピクミンシリーズ、ピクチャレ大会、ピクミン界隈にまつわる専門用語や流行語などをなんでも保存しておくためのページです。ログインしていればどなたでも編集できます。
                <Box sx={{ margin: '1em'}}>
                    <ul>
                        <li>キーワード名は簡潔でわかりやすい表現を心がけてください。</li>
                        <li>ゲームタイトルは『』で囲んでください。強調したい言葉は「」で囲んでください。</li>
                        <li>プレイヤー名を記述する場合は末尾に「氏」をつけてください。</li>
                    </ul>
                </Box>
            </Box>

            <FormDialog></FormDialog>
            {
                props.data.map(post =>
                    <KeywordPost data={post} />
                )
            }
        </>
    )
}