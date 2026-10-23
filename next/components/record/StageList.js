import useDandoriCatalog from '../../hooks/useDandoriCatalog'
import {Box, Grid} from "@mui/material";
import Link from "next/link";
import styled from 'styled-components'
import * as React from "react";
import {currentYear, useLocale} from "../../lib/pik5";
import {stageUrlOutput} from "../../lib/factory";

const StageListViewport = styled(Box)`
    ${({$hideScrollbar}) => $hideScrollbar && `
        scrollbar-width: none;
        -ms-overflow-style: none;
        &::-webkit-scrollbar { display: none; }
    `}

    ${({$limited}) => $limited && `
        /* Cell min-height 5.5em at 0.8em font size, plus its two 2px margins. */
        --stage-list-row-height: calc(4.4em + 4px);
        max-height: calc(var(--stage-list-row-height) * 5);
        .stage-list-grid > .MuiGrid-item { height: var(--stage-list-row-height); }
        .stage-list-box { height: calc(100% - 4px); box-sizing: border-box; overflow: hidden; }
    `}
`

export default function StageList({parent, currentStage, stages, consoles, rule, year, limitRows = false}){

    const {t, locale} = useLocale()
    const catalog = useDandoriCatalog()
    // More than 16 stages use ten columns on every screen size.
    const limited = limitRows && stages?.length > 50

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
        <StageListViewport
            $limited={limited}
            $hideScrollbar={limitRows}
            className="stage-list-wrapper"
            data-stage-scroll-limited={limited || undefined}
            tabIndex={limited ? 0 : undefined}
            role={limited ? 'region' : undefined}
            aria-label={limited ? 'ステージ一覧（5行ずつスクロール）' : undefined}
            style={{
                width: "100%",
                ...(stages?.length > 16 ? {
                    overflowX: "auto",
                    overflowY: limited ? "auto" : "hidden",
                    whiteSpace: "nowrap",
                } : {}),
            }}
        >
            <Grid container className="stage-list-grid" style={{minWidth:(stages?.length > 16) ? "1200px" : "100%"}}
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
        </StageListViewport>
    )
}
