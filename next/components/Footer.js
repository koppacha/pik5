import {Grid} from "@mui/material";

export default function Footer(){
    return (
        <>
            <Grid container style={{backgroundColor:"#444",width:'100%', padding:'20px'}}>
                <Grid item xs={3}></Grid>
                <Grid item xs={3}>
                    ピクミン<br/>
                    ピクミン2<br/>
                    ピクミン3/DX<br/>
                    ピクミン4<br/>
                    本編RTA<br/>
                    期間限定<br/>
                    キーワード<br/>
                </Grid>
                <Grid item xs={3}>
                    Pikmin Series Leaderboards ver.3.00<br/>
                    Copyright © 2006-2023 @koppachappy<br/>
                    当サイトは非公式であり、任天堂株式会社とは関係ありません。<br/>
                </Grid>
                <Grid item xs={3}></Grid>
            </Grid>
        </>
    )
}