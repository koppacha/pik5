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
import prisma from "../../lib/prisma";

export async function getStaticPaths(){
    return {
        paths: [],
        fallback: 'blocking',
    }
}
export async function getStaticProps({params}){

    const id = params.keyword

    // キーワード情報をリクエスト
    const res = await fetch(`http://laravel:8000/api/keyword/${id}`)
    const data = await res.json()

    if(!data){
        return {
            notFound: true,
        }
    }

    // スクリーンネームをリクエスト（検索用）
    const users = await prisma.user.findMany({
        select: {
            userId: true,
            name: true
        }
    })

    return {
        props: {
            data: data, users
        },
        revalidate: 60,
    }
}

export default function Keyword({data}) {

    const {t} = useLocale()

    return (
        <>
            <Head>
                <title>{data.keyword+" - "+t.title[0]}</title>
            </Head>
            <Box className="page-header">
                <Link href="/"><FontAwesomeIcon icon={faHouseChimney}/></Link>
                <StairIcon icon={faStairs}/>
                <Link href="/keyword">{t.g.keyword}</Link><br/>
                <KeywordContent data={data}/>
            </Box>
        </>
    )
}