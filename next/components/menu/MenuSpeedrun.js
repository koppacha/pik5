import {ClickAwayListener, Grid, MenuItem, MenuList, Paper, Typography} from "@mui/material";
import * as React from "react";
import Link from "next/link";
import {useLocale} from "../../lib/pik5";
import {HeaderPopMenu, SeriesTheme, StyledMenuItem} from "../../styles/pik5.css";
import {p4} from "../../lib/const";

export default function MenuSpeedrun(props){

    const {t} = useLocale()
    const speedruns = [101, 102, 201, 202, 203, 204, 301, 302, 303, 311, 312, 313, 401, 402, 403, 404, 405]

    return (
        <HeaderPopMenu>
            <ClickAwayListener onClickAway={props.handleClose}>
                <MenuList
                    autoFocusItem={open}
                    id="composition-menu"
                    aria-labelledby="composition-button"
                    onKeyDown={props.handleListKeyDown}
                    disablePadding
                >
                    <Grid container onClick={props.handleClose}>
                        <Grid item xs={3} style={{position:"relative",left:"529px"}}>
                            {
                                speedruns.map(n=>
                                    <StyledMenuItem key={n} style={{
                                        borderLeft:"solid 10px "+SeriesTheme(6),
                                    }} component={Link} href={"/speedrun/"+n} onClick={props.handleClose}><Typography style={{color:"#e7259e"}}>#</Typography>{n} {t.speedrun[n]}</StyledMenuItem>
                                )
                            }
                        </Grid>
                    </Grid>
                </MenuList>
            </ClickAwayListener>
        </HeaderPopMenu>
    )
}