import {Grid} from "@mui/material";
import Link from "next/link";
import {StageListBox} from "../../styles/pik5.css";
import * as React from "react";
import {useLocale} from "../../lib/pik5";

export default function StageList({stages}){

    const {t} = useLocale()


    return (
        <Grid container style={{margin:"2em 0"}} columns={{xs: 4, sm: 4, md: 6, lg: 10, xl: 10}}>
            {
                stages?.map(stage =>
                    <Grid key={stage} item xs={1}>
                        <Link key={stage} href={'/stage/'+stage}>
                            <StageListBox>#{stage}<br/>{t.stage[stage].length > 15 ? t.stage[stage].substring(0, 14)+".." : t.stage[stage]}</StageListBox>
                        </Link>
                    </Grid>
                )
            }
        </Grid>
    )
}