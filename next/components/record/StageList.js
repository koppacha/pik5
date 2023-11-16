import {Box, Grid} from "@mui/material";
import Link from "next/link";
import {StageListBox, StageListWrapper} from "../../styles/pik5.css";
import * as React from "react";
import {useLocale} from "../../lib/pik5";

export default function StageList({stages, consoles, rule, year}){

    const {t} = useLocale()


    return (
        <StageListWrapper count={stages.length}>
            <Grid container style={{minWidth:(stages.length > 16) ? "1200px" : "100%"}}
                  columns={{xs:(stages.length > 16) ? 10 : 4, lg : 10}}>
                {
                    stages?.map(stage =>
                        <Grid style={{whiteSpace:"nowrap"}} key={stage} item xs={1}>
                            <Link key={stage} href={'/stage/'+stage+'/'+consoles+'/'+rule+'/'+year}>
                                <StageListBox>#{stage}<br/>{t.stage[stage].length > 15 ? t.stage[stage].substring(0, 14)+".." : t.stage[stage]}</StageListBox>
                            </Link>
                        </Grid>
                    )
                }
            </Grid>
        </StageListWrapper>
    )
}