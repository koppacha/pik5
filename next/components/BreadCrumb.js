import {FontAwesomeIcon} from "@fortawesome/react-fontawesome";
import Link from "next/link";
import {faCircleNotch, faHouseChimney, faStairs} from "@fortawesome/free-solid-svg-icons";
import * as React from "react";
import Styled from "styled-components";
import {fetcher, useLocale} from "../plugin/pik5";
import useSWR from "swr";
import {Typography} from "@mui/material";
import NowLoading from "./NowLoading";
import {StairIcon} from "../styles/pik5.css";

export default function BreadCrumb({info, rule}){

    const {t} = useLocale()

    // 親ステージの親番号を取得する
    const {data:superParent} = useSWR(`http://localhost:8000/api/stage/${rule}`, fetcher)

    if(!superParent){
        return (
            <NowLoading/>
        )
    }

    return (
        <>
            <Link href="/"><FontAwesomeIcon icon={faHouseChimney}/></Link>
            <StairIcon icon={faStairs}/>
            <Link href={"/total/"+superParent.parent}>{t.stage[superParent.parent]}</Link>
            <StairIcon icon={faStairs}/>
            <Link href={"/total/"+info.series+"0"}>{t.title[info.series]}</Link>
            {
                (info.parent)
                    ?
                    <>
                        <StairIcon icon={faStairs}/>
                        <Link href={"/total/"+info.parent}>{t.rule[info.parent]}</Link>
                    </>
                    :
                    ""
            }
            <br/>
        </>
    )
}