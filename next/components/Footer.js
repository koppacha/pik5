import {Grid} from "@mui/material";

export default function Footer(){
    return (
        <>
            <Grid container style={{backgroundColor:"#111",width:'100%', padding:'20px'}}>
                <Grid item xs={12} style={{fontSize:"0.75em",textAlign:"right"}}>
                    Pikmin Series Leaderboards ver.3.00 Copyright © 2006-2023 @koppachappy
                </Grid>
            </Grid>
        </>
    )
}