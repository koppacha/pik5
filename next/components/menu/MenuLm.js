import {ClickAwayListener, Grid, MenuItem, MenuList, Paper} from "@mui/material";
import * as React from "react";
import {HeaderPopMenu, SeriesTheme, StyledMenuItem} from "../../styles/pik5.css";
import Link from "next/link";
import {lm, mx, ev} from "../../lib/const";
import {useLocale} from "../../lib/pik5";

export default function MenuLm(props){

    const {t} = useLocale()
    const color = "#777777"
    
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
                        <Grid item xs={3} style={{position:"relative",left:"600px"}}>
                            <StyledMenuItem key={0} style={{
                                borderLeft:"solid 10px "+SeriesTheme(5),
                            }} component={Link} href={"/total/4/"} onClick={props.handleClose}>イベント全総合</StyledMenuItem>

                            {
                                ev.map(n=>
                                    <StyledMenuItem key={n} style={{
                                        borderLeft:"solid 10px "+SeriesTheme(5),
                                    }} component={Link} href={"/total/4/"+n} onClick={props.handleClose}>#{n} {t.limited.category[n]}</StyledMenuItem>
                                )
                            }
                        </Grid>
                    </Grid>
                </MenuList>
            </ClickAwayListener>
        </HeaderPopMenu>
    )
}