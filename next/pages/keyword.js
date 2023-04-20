import Record from "../components/Record";
import {Box, Typography} from "@mui/material";
import FormDialog from "../components/FromDialog";
import {useRouter} from "next/router";

export async function getServerSideProps(context){

    // 記録をリクエスト
    const res = await fetch(`http://laravel:8000/api/keyword`)
    const data = await res.json()

    return {
        props: {
            data
        }
    }
}

function KeywordPost(props) {

    return (
        <>
            <Typography variant="h5" sx={{
                fontFamily:['"M PLUS 1 CODE"'].join(","),
            }}>{props.data.keyword}</Typography>
            <Box sx={{
                borderTop:"1px solid #fff",
                marginBottom:"40px",
                padding:"8px"
            }}>
                {props.data.content}
            </Box>
        </>
    )
}

export default function Keyword(param){

    return (
        <>
            ピクミンキーワード
            <FormDialog></FormDialog>
            {
                Object.values(param.data).map(post =>
                    <KeywordPost data={post} />
                )
            }
        </>
    )
}