import Button from "@mui/material/Button";
import {Box, Typography} from "@mui/material";
import ReactMarkdown from "react-markdown";
import {KeywordContent} from "../../components/KeywordContent";

export async function getServerSideProps(context){

    const id = context.query.keyword

    // ステージ情報をリクエスト
    const res = await fetch(`http://laravel:8000/api/keyword/${id}`)
    const data = await res.json()

    return {
        props: {
            data: data
        }
    }
}

export default function Keyword({data}) {

    return (
        <>
            <KeywordContent data={data}/>
        </>
    )
}