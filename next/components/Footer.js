import Link from "next/link";
import {Grid} from "@mui/material";

import {useLocale} from "../lib/pik5"
import {japanYear} from "../lib/yearRecords.mjs"

export default function Footer(){
    const {t} = useLocale()
    return (
        <>
            <Grid container style={{backgroundColor:"var(--color-surface-inverse-bg)",width:'100%', padding:'5px 20px'}}>
                <Grid item xs={12} style={{fontSize:"0.75em",textAlign:"right"}}>
                    <Link href={`/date/${japanYear()}`}>{t.yearRecords.title}</Link>{" | "}
                    the Pikmin Challenge Leaderboards | Copyright © 2006-2026 <Link href="https://x.com/koppachappy">@koppachappy</Link>
                </Grid>
            </Grid>
        </>
    )
}
