import {Box, Grid} from "@mui/material";
import Link from "next/link";
import {StageListBox, StageListWrapper} from "../../styles/pik5.css";
import * as React from "react";
import {useLocale} from "../../lib/pik5";

export default function StageList({stages}){

    const {t} = useLocale()


    return (
        <StageListWrapper>
            <Grid style={{minWidth:"1200px"}} container columns={{xs: 10}}>
                {
                    stages?.map(stage =>
                        <Grid style={{whiteSpace:"nowrap"}} key={stage} item xs={1}>
                            <Link key={stage} href={'/stage/'+stage}>
                                <StageListBox>#{stage}<br/>{t.stage[stage].length > 15 ? t.stage[stage].substring(0, 14)+".." : t.stage[stage]}</StageListBox>
                            </Link>
                        </Grid>
                    )
                }
            </Grid>
        </StageListWrapper>
    )
}