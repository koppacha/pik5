import {ClickAwayListener, Grid, MenuItem, MenuList, Paper} from "@mui/material";
import * as React from "react";
import {HeaderPopMenu, SeriesTheme, StyledMenuItem} from "../../styles/pik5.css";
import Link from "next/link";
import {lm, mx} from "../../lib/const";
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
                        <Grid item xs={3} style={{position:"relative",left:"529px"}}>
                            {
                                lm.map(n=>
                                    <StyledMenuItem key={n} style={{
                                        borderLeft:"solid 10px "+SeriesTheme(5),
                                    }} component={Link} href={"/limited/"+n} onClick={props.handleClose}>20{String(n).slice(0, 2)+"/"+String(n).slice(2, 4)+"/"+String(n).slice(4, 6)} {t.limited[n]}</StyledMenuItem>
                                )
                            }
                        </Grid>
                    </Grid>
                </MenuList>
            </ClickAwayListener>
        </HeaderPopMenu>
    )
}