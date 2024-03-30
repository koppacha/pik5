import {Grid} from "@mui/material";

export default function Footer(){
    return (
        <>
            <Grid container style={{backgroundColor:"#111",width:'100%', padding:'20px'}}>
                <Grid item xs={12} style={{fontSize:"0.75em",textAlign:"right"}}>
                    "the Pikmin Series Leaderboards" Copyright © 2006-2024 @koppachappy
                </Grid>
            </Grid>
        </>
    )
}