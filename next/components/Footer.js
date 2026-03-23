import {Grid} from "@mui/material";

export default function Footer(){
    return (
        <>
            <Grid container style={{backgroundColor:"var(--color-surface-inverse-bg)",width:'100%', padding:'5px 20px'}}>
                <Grid item xs={12} style={{fontSize:"0.75em",textAlign:"right"}}>
                    the Pikmin Series Leaderboards | Copyright © 2006-2026 @koppachappy
                </Grid>
            </Grid>
        </>
    )
}
