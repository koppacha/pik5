import {Box, Grid} from "@mui/material";
import Link from "next/link";
import {StageListBox, StageListWrapper} from "../../styles/pik5.css";
import * as React from "react";
import {currentYear, stageUrlOutput, useLocale} from "../../lib/pik5";

export default function StageList({parent, currentStage, stages, consoles, rule, year}){

    const {t} = useLocale()

    return (
        <StageListWrapper count={stages?.length}>
            <Grid container style={{minWidth:(stages?.length > 16) ? "1200px" : "100%"}}
                  columns={{xs:(stages?.length > 16) ? 10 : 4, lg : 10}}>
                {
                    stages?.map(function(stage){
                        return (
                            <Grid style={{whiteSpace:"nowrap"}} key={stage} item xs={1}>
                                <Link key={stage} href={'/stage/'+stageUrlOutput(stage, consoles, rule, year, parent)}>
                                    <StageListBox className={(Number(currentStage) === stage)&&"active"}>#{stage}<br/>{t.stage[stage].length > 15 ? t.stage[stage].substring(0, 14).replace(" ","\n")+".." : t.stage[stage].replace(" ","\n")}</StageListBox>
                                </Link>
                            </Grid>
                        )}
                    )
                }
            </Grid>
        </StageListWrapper>
    )
}