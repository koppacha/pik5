import {
    Card,
    CardContent,
    CardHeader,
    ClickAwayListener,
    Grid,
    List,
    ListItem,
    MenuList,
    Paper
} from "@mui/material";
import * as React from "react";
import Link from "next/link";
import {HeaderPopMenu, SeriesTheme, StyledMenuItem} from "../../styles/pik5.css";
import {useLocale} from "../../lib/pik5";
import {du, eg, ne, p1} from "../../lib/const";

export default function Menu1(props){

    const {t} = useLocale()

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
                        <Grid item xs={3} style={{position:"relative",left:"200px"}}>
                            <StyledMenuItem style={{
                                borderLeft:"solid 10px "+SeriesTheme(1),
                            }} component={Link} href="/total/10" onClick={props.handleClose}>ピクミン1総合</StyledMenuItem>
                            {
                                p1.map(n=>
                                    <StyledMenuItem key={n} style={{
                                        borderLeft:"solid 10px "+SeriesTheme(1),
                                    }} component={Link} href={"/stage/"+n} onClick={props.handleClose}>#{n} {t.stage[n]}</StyledMenuItem>
                                )
                            }
                        </Grid>
                    </Grid>
                </MenuList>
            </ClickAwayListener>
        </HeaderPopMenu>
    )
}