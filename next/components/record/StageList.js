import useDandoriCatalog from '../../hooks/useDandoriCatalog'
import {Box, Grid} from "@mui/material";
import Link from "next/link";
import {StageListBox} from "../../styles/pik5.css";
import * as React from "react";
import {currentYear, useLocale} from "../../lib/pik5";
import {stageUrlOutput} from "../../lib/factory";

export default function StageList({parent, currentStage, stages, consoles, rule, year}){

    const {t, locale} = useLocale()
    const catalog = useDandoriCatalog()

    function stageNameFormat(stage){
        // 文字数制限日本語なら16文字、英語なら32文字（混在は考慮しない）
        const len = locale === "ja" ? 16 : 32
        const metadata = catalog?.stages?.find(item => String(item.stage_code) === String(stage))
        let stageName = (locale === 'en' ? metadata?.eng_stage_name : metadata?.stage_name) || t.stage[stage] || ''
        if(stageName.length > len){
            // 15文字より多かったら14文字にする
            stageName = stageName.substring(0, len - 1)+".."
        }
        // 通常ステージの半角スペースは改行に置き換える
        stageName = stageName.replace(/([！？１２３４ン:]) /, "$1\n")
        return stageName ?? ""
    }

    return (
        <Box
            className="stage-list-wrapper"
            style={{
                width: "100%",
                ...(stages?.length > 16 ? {
                    overflowX: "auto",
                    overflowY: "hidden",
                    whiteSpace: "nowrap",
                } : {}),
            }}
        >
            <Grid container style={{minWidth:(stages?.length > 16) ? "1200px" : "100%"}}
                  columns={{xs:(stages?.length > 16) ? 10 : 4, md:(stages?.length > 16) ? 10 : 6, lg : 10}}>
                {
                    stages?.map(function(stage){
                        const metadata = catalog?.stages?.find(item => String(item.stage_code) === String(stage))
                        const stageRule = Number(rule) === 40 && Number(metadata?.parent) === 48 ? 48 : rule
                        return (
                            <Grid style={{whiteSpace:"nowrap"}} key={stage} item xs={1}>
                                <Link key={stage} href={'/stage/'+stageUrlOutput(stage, consoles, stageRule, year, parent)}>
                                    <Box className={`stage-list-box ${(String(currentStage) === String(stage))&&"active"}`}>#{stage}<br/>{stageNameFormat(stage)}</Box>
                                </Link>
                            </Grid>
                        )}
                    )
                }
            </Grid>
        </Box>
    )
}
