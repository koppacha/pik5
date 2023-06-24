import Button from "@mui/material/Button";
import {Box, Typography} from "@mui/material";
import ReactMarkdown from "react-markdown";
import {KeywordContent} from "../../components/KeywordContent";
import Link from "next/link";
import {FontAwesomeIcon} from "@fortawesome/react-fontawesome";
import {faHouseChimney, faStairs} from "@fortawesome/free-solid-svg-icons";
import {StairIcon} from "../../styles/pik5.css";
import React from "react";

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
            <Link href="/"><FontAwesomeIcon icon={faHouseChimney}/></Link>
            <StairIcon icon={faStairs}/>
            <Link href="/keyword">ピクミンキーワード</Link><br/>
            <KeywordContent data={data}/>
        </>
    )
}