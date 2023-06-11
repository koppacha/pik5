import {RuleBox} from "../styles/pik5.css";
import Link from "next/link";
import * as React from "react";

export default function SpeedRunRules({stage, console}){

    // ステージ番号からシリーズ番号を特定する
    const series = stage.slice(0, 2)
    if(series === "10"){
        return (
            <>
                <RuleBox component={Link} href={'/speedrun/101/'+console}>全パーツ</RuleBox>
                <RuleBox component={Link} href={'/speedrun/102/'+console}>最小限全パーツ</RuleBox>
            </>
        )
    } else if(series === "20"){
        return (
            <>
                <RuleBox component={Link} href={'/speedrun/201/'+console}>借金返済</RuleBox>
                <RuleBox component={Link} href={'/speedrun/202/'+console}>お宝全回収</RuleBox>
                <RuleBox component={Link} href={'/speedrun/203/'+console}>バグなし借金返済</RuleBox>
                <RuleBox component={Link} href={'/speedrun/204/'+console}>バグなしお宝全回収</RuleBox>
            </>
        )
    } else if(series === "30"){
        return (
            <>
                <RuleBox component={Link} href={'/speedrun/301/'+console}>Any%</RuleBox>
                <RuleBox component={Link} href={'/speedrun/302/'+console}>通常エンディング</RuleBox>
                <RuleBox component={Link} href={'/speedrun/303/'+console}>フルーツ全回収</RuleBox>
            </>
        )
    } else if(series === "31"){
        return (
            <>
                <RuleBox component={Link} href={'/speedrun/311/'+console}>Any%</RuleBox>
                <RuleBox component={Link} href={'/speedrun/312/'+console}>ステージクリア</RuleBox>
                <RuleBox component={Link} href={'/speedrun/313/'+console}>お宝全回収</RuleBox>
            </>
        )
    } else {
        return null
    }
}