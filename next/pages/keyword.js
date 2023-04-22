import Record from "../components/Record";
import {Box, Typography} from "@mui/material";
import FormDialog from "../components/FromDialog";
import {useRouter} from "next/router";
import {useSSR} from "@react-libraries/use-ssr";

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

export default function Keyword(){

    const [data, setData] = useSSR(
        "data",
        async (data, setData) => {

            console.log(data)

            if(data !== undefined) return
            setData(null)

            const result = await fetch(
                `http://laravel:8000/api/keyword`
            )
                .then((r) => r.json())
                .catch(() => null)

            setData(result)
        }
    )

    return (
        <>
            ピクミンキーワード
            <FormDialog setData={setData}></FormDialog>
            {
                data.map(post =>
                    <KeywordPost data={post} />
                )
            }
        </>
    )
}