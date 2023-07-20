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
import {HeaderPopMenu, StyledMenuItem} from "../../styles/pik5.css";
import {useLocale} from "../../lib/pik5";
import {p4} from "../../lib/const";

const p4Color = "#ffde5b"

export default function Menu4(props){

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
                        <Grid item xs={3} style={{position:"relative",left:"427px"}}>
                            <StyledMenuItem style={{
                                borderLeft:"solid 10px "+p4Color,
                            }} component={Link} href="/total/10" onClick={props.handleClose}>ピクミン4総合</StyledMenuItem>
                            {
                                p4.map(n=>
                                    <StyledMenuItem key={n} style={{
                                        borderLeft:"solid 10px "+p4Color,
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