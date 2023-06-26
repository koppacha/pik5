import {RuleBox} from "../../styles/pik5.css";
import Link from "next/link";
import * as React from "react";
import {useLocale} from "../../lib/pik5";

export default function SpeedRunRules({stage, console}){

    const {t} = useLocale()

    // ステージ番号からシリーズ番号を特定する
    const series = stage.slice(0, 2)
    if(series === "10"){
        return (
            <>
                <RuleBox component={Link} href={'/speedrun/101/'+console}>{t.speedrun.s[101]}</RuleBox>
                <RuleBox component={Link} href={'/speedrun/102/'+console}>{t.speedrun.s[102]}</RuleBox>
            </>
        )
    } else if(series === "20"){
        return (
            <>
                <RuleBox component={Link} href={'/speedrun/201/'+console}>{t.speedrun.s[201]}</RuleBox>
                <RuleBox component={Link} href={'/speedrun/202/'+console}>{t.speedrun.s[202]}</RuleBox>
                <RuleBox component={Link} href={'/speedrun/203/'+console}>{t.speedrun.s[203]}</RuleBox>
                <RuleBox component={Link} href={'/speedrun/204/'+console}>{t.speedrun.s[204]}</RuleBox>
            </>
        )
    } else if(series === "30"){
        return (
            <>
                <RuleBox component={Link} href={'/speedrun/301/'+console}>{t.speedrun.s[301]}</RuleBox>
                <RuleBox component={Link} href={'/speedrun/302/'+console}>{t.speedrun.s[302]}</RuleBox>
                <RuleBox component={Link} href={'/speedrun/303/'+console}>{t.speedrun.s[303]}</RuleBox>
            </>
        )
    } else if(series === "31"){
        return (
            <>
                <RuleBox component={Link} href={'/speedrun/311/'+console}>{t.speedrun.s[311]}</RuleBox>
                <RuleBox component={Link} href={'/speedrun/312/'+console}>{t.speedrun.s[312]}</RuleBox>
                <RuleBox component={Link} href={'/speedrun/313/'+console}>{t.speedrun.s[313]}</RuleBox>
            </>
        )
    } else {
        return null
    }
}