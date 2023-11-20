import {FontAwesomeIcon} from "@fortawesome/react-fontawesome";
import Link from "next/link";
import {faCircleNotch, faHouseChimney, faStairs} from "@fortawesome/free-solid-svg-icons";
import * as React from "react";
import Styled from "styled-components";
import {fetcher, useLocale} from "../lib/pik5";
import useSWR from "swr";
import {Typography} from "@mui/material";
import NowLoading from "./NowLoading";
import {StairIcon} from "../styles/pik5.css";
import {logger} from "../lib/logger";

export default function BreadCrumb({info, rule}){

    const {t} = useLocale()
    const superParent = () => {
        // 通常ランキング
        if([0, 10, 20, 21, 22, 30, 31, 32, 33, 36, 40, 41, 42, 43].includes(Number(rule))){
            return 2
        }
        // 特殊ランキング
        if(rule < 100){
            return 3
        }
        // 期間限定ランキング
        return 4
    }

    return (
        <>
            {
                // 第０階層（ホームページ）
            }
            <Link href="/"><FontAwesomeIcon icon={faHouseChimney}/></Link>
            {
                // 第１階層（表示画面が通常総合 or 特殊総合でなかった場合は通常総合 or 特殊総合を表示）
                (info?.parent > 1) ?
                <>
                    <StairIcon icon={faStairs}/>
                    <Link href={"/total/"+superParent()}>{t.stage[superParent()]}</Link>
                </>
                :
                // 第１階層（表示画面が通常総合 or 特殊総合の場合は全総合を表示）
                <>
                    <StairIcon icon={faStairs}/>
                    <Link href={"/total/1"}>{t.stage[1]}</Link>
                </>
            }
            {
                // 第２階層（シリーズ別総合）
                (info?.parent > 9 && info.parent < 100) ?
                <>
                    <StairIcon icon={faStairs}/>
                    <Link href={"/total/"+info.series+"0"}>{t.title[info.series]}</Link>
                </>
                // 第２階層（期間限定）
                :(t.limited[info?.parent]) &&
                <>
                    <StairIcon icon={faStairs}/>
                    <Link href={"/limited/"+info.parent}>{t.limited[info.parent]}</Link>
                </>
            }
            {
                // 第３階層（サブカテゴリ）
                (info?.parent > 20 && info?.parent < 90) &&
                <>
                    <StairIcon icon={faStairs}/>
                    <Link href={"/total/"+info.parent}>{t.rule[info.parent]}</Link>
                </>
            }
            <br/>
        </>
    )
}