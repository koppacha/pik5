import Button from "@mui/material/Button";
import {Box, Typography} from "@mui/material";
import ReactMarkdown from "react-markdown";
import {KeywordContent} from "../../components/modal/KeywordContent";
import Link from "next/link";
import {FontAwesomeIcon} from "@fortawesome/react-fontawesome";
import {faHouseChimney, faStairs} from "@fortawesome/free-solid-svg-icons";
import {StairIcon} from "../../styles/pik5.css";
import React from "react";
import {useLocale} from "../../lib/pik5";
import Head from "next/head";

export async function getServerSideProps(context){

    const id = context.query.keyword

    // キーワード情報をリクエスト
    const res = await fetch(`http://laravel:8000/api/keyword/${id}`)
    const data = await res.json()

    if(!data){
        return {
            notFound: true,
        }
    }
    return {
        props: {
            data: data
        }
    }
}

export default function Keyword({data}) {

    const {t} = useLocale()

    return (
        <>
            <Head>
                <title>{`${data.keyword} - ${t.title[0]}`}</title>
            </Head>
            <Box style={{height:"100vh"}}>
                <Link href="/"><FontAwesomeIcon icon={faHouseChimney}/></Link>
                <StairIcon icon={faStairs}/>
                <Link href="/keyword">{t.g.keyword}</Link><br/>
                <KeywordContent data={data}/>
            </Box>
        </>
    )
}