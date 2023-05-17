import {ClickAwayListener, Grid, MenuItem, MenuList, Paper} from "@mui/material";
import * as React from "react";
import {range} from "@/plugin/myfunction";
import {useRouter} from "next/router";
import {en} from "@/locale/en";
import {ja} from "@/locale/ja";

const p4 = range(401, 405)

export default function Menu4(props){

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
                        backgroundColor:"#ffea80",
                    }}
                >
                    <Grid container spacing={2}>
                        <Grid item xs={12}>
                            ピクミン４チャレンジモード
                            {
                                p4.map(n=>
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