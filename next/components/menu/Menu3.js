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
import {be, ce, ss, db, sb} from "../../lib/const";

const ceColor = "#bdf13a"
const beColor = "#59e1a8"
const ssColor = "#35e73e"
const dbColor = "#37b3c9"
const sbColor = "#b6f153"

export default function Menu3(props){

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
                    <Grid container spacing={0} onClick={props.handleClose}>
                        <Grid item xs={2.4}>
                            <StyledMenuItem style={{
                                borderLeft:"solid 10px "+ceColor,
                            }} component={Link} href="/total/31" onClick={props.handleClose}>お宝をあつめろ！総合</StyledMenuItem>

                            {
                                ce.map(n=>
                                    <StyledMenuItem key={n} style={{
                                        borderLeft:"solid 10px "+ceColor,
                                    }} component={Link} href={"/stage/"+n} onClick={props.handleClose}>#{n} {t.stage[n]}</StyledMenuItem>
                                )
                            }
                        </Grid>
                        <Grid item xs={2.4}>
                            <StyledMenuItem style={{
                                borderLeft:"solid 10px "+beColor,
                            }}  component={Link} href="/total/32" onClick={props.handleClose}>原生生物をたおせ！総合</StyledMenuItem>
                            {
                                be.map(n=>
                                    <StyledMenuItem key={n} style={{
                                        borderLeft:"solid 10px "+beColor,
                                    }} component={Link} href={"/stage/"+n} onClick={props.handleClose}>#{n} {t.stage[n]}</StyledMenuItem>
                                )
                            }
                        </Grid>
                        <Grid item xs={2.4}>
                            <StyledMenuItem style={{
                                borderLeft:"solid 10px "+dbColor,
                            }}  component={Link} href="/total/33" onClick={props.handleClose}>巨大生物をたおせ！総合</StyledMenuItem>
                            {
                                db.map(n=>
                                    <StyledMenuItem key={n} style={{
                                        borderLeft:"solid 10px "+dbColor,
                                    }} component={Link} href={"/stage/"+n} onClick={props.handleClose}>#{n} {t.stage[n]}</StyledMenuItem>
                                )
                            }
                        </Grid>
                        <Grid item xs={2.4}>
                            <StyledMenuItem style={{
                                borderLeft:"solid 10px "+ssColor,
                            }}  component={Link} href="/total/34" onClick={props.handleClose}>サイドストーリー総合</StyledMenuItem>
                            {
                                ss.map(n=>
                                    <StyledMenuItem key={n} style={{
                                        borderLeft:"solid 10px "+ssColor,
                                    }} component={Link} href={"/stage/"+n} onClick={props.handleClose}>#{n} {t.stage[n]}</StyledMenuItem>
                                )
                            }
                        </Grid>
                        <Grid item xs={2.4}>
                            <StyledMenuItem style={{
                                borderLeft:"solid 10px "+sbColor,
                            }}  component={Link} href="/total/35" onClick={props.handleClose}>ソロビンゴ総合</StyledMenuItem>
                            {
                                sb.map(n=>
                                    <StyledMenuItem key={n} style={{
                                        borderLeft:"solid 10px "+sbColor,
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