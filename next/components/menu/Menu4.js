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
import {dc, dd, ex, ni} from "../../lib/const";

const dcColor = "#ffde5b"
const ddColor = "#d7b842"
const exColor = "#ccb868"
const niColor = "#bfcc68"

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
                        <Grid item xs={3}>
                            <StyledMenuItem style={{
                                borderLeft:"solid 10px "+dcColor,
                            }} component={Link} href="/total/41" onClick={props.handleClose}>ダンドリチャレンジ総合</StyledMenuItem>
                            {
                                dc.map(n=>
                                    <StyledMenuItem key={n} style={{
                                        borderLeft:"solid 10px "+dcColor,
                                    }} component={Link} href={"/stage/"+n} onClick={props.handleClose}>#{n} {t.stage[n]}</StyledMenuItem>
                                )
                            }
                        </Grid>
                        <Grid item xs={3}>
                            <StyledMenuItem style={{
                                borderLeft:"solid 10px "+ddColor,
                            }} component={Link} href="/total/42" onClick={props.handleClose}>ダンドリバトル総合</StyledMenuItem>
                            {
                                dd.map(n=>
                                    <StyledMenuItem key={n} style={{
                                        borderLeft:"solid 10px "+ddColor,
                                    }} component={Link} href={"/stage/"+n} onClick={props.handleClose}>#{n} {t.stage[n]}</StyledMenuItem>
                                )
                            }
                        </Grid>
                        <Grid item xs={3}>
                            <StyledMenuItem style={{
                                borderLeft:"solid 10px "+exColor,
                            }} component={Link} href="/total/43" onClick={props.handleClose}>葉っぱ仙人の挑戦状総合</StyledMenuItem>
                            {
                                ex.map(n=>
                                    <StyledMenuItem key={n} style={{
                                        borderLeft:"solid 10px "+exColor,
                                    }} component={Link} href={"/stage/"+n} onClick={props.handleClose}>#{n} {t.stage[n]}</StyledMenuItem>
                                )
                            }
                        </Grid>
                        <Grid item xs={3}>
                            <StyledMenuItem style={{
                                borderLeft:"solid 10px "+niColor,
                            }} component={Link} href="/total/47" onClick={props.handleClose}>夜の探検総合</StyledMenuItem>
                            {
                                ni.map(n=>
                                    <StyledMenuItem key={n} style={{
                                        borderLeft:"solid 10px "+niColor,
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