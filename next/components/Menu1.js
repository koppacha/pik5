import {ClickAwayListener, Grid, MenuItem, MenuList, Paper} from "@mui/material";
import * as React from "react";
import {range} from "@/plugin/myfunction";
import {useRouter} from "next/router";
import {en} from "@/locale/en";
import {ja} from "@/locale/ja";

const p1 = range(101, 105)

export default function Menu1(props){

    const { locale } = useRouter();
    const t = (locale === "en") ? en : ja;

    return (
        <Paper>
            <ClickAwayListener onClickAway={props.handleClose}>
                <MenuList
                    autoFocusItem={open}
                    id="composition-menu"
                    aria-labelledby="composition-button"
                    onKeyDown={props.handleListKeyDown}
                    sx={{
                        backgroundColor:"#ffb17d",
                    }}
                >
                    <Grid container spacing={2}>
                        <Grid item xs={12}>
                            ピクミンチャレンジモード
                            {
                                p1.map(n=>
                                    <MenuItem onClick={props.handleClose}>#{n} {t.stage[n]}</MenuItem>
                                )
                            }
                        </Grid>
                    </Grid>
                </MenuList>
            </ClickAwayListener>
        </Paper>
    )
}