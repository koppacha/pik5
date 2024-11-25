import {Box, Grid} from "@mui/material";
import Link from "next/link";
import {StageListBox, StageListWrapper} from "../../styles/pik5.css";
import * as React from "react";
import {currentYear, stageUrlOutput, useLocale} from "../../lib/pik5";

export default function StageList({parent, currentStage, stages, consoles, rule, year}){

    const {t, locale} = useLocale()

    function stageNameFormat(stage){
        // 文字数制限日本語なら16文字、英語なら32文字（混在は考慮しない）
        const len = locale === "ja" ? 16 : 32
        let stageName = t.stage[stage] ?? ""
        if(stageName.length > len){
            // 15文字より多かったら14文字にする
            stageName = stageName.substring(0, len - 1)+".."
        }
        // 通常ステージの半角スペースは改行に置き換える
        stageName = stageName.replace(/([！？１２３４ン:]) /, "$1\n")
        return stageName ?? ""
    }

    return (
        <StageListWrapper className="stage-list-wrapper" count={stages?.length}>
            <Grid container style={{minWidth:(stages?.length > 16) ? "1200px" : "100%"}}
                  columns={{xs:(stages?.length > 16) ? 10 : 4, md:(stages?.length > 16) ? 10 : 6, lg : 10}}>
                {
                    stages?.map(function(stage){
                        return (
                            <Grid style={{whiteSpace:"nowrap"}} key={stage} item xs={1}>
                                <Link key={stage} href={'/stage/'+stageUrlOutput(stage, consoles, rule, year, parent)}>
                                    <Box className={`stage-list-box ${(Number(currentStage) === stage)&&"active"}`}>#{stage}<br/>{stageNameFormat(stage)}</Box>
                                </Link>
                            </Grid>
                        )}
                    )
                }
            </Grid>
        </StageListWrapper>
    )
}