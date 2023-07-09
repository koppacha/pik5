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
import {useRouter} from "next/router";
import {en} from "@/locale/en";
import {ja} from "@/locale/ja";
import Link from "next/link";
import {StyledMenuItem} from "../../styles/pik5.css";
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
        <Paper>
            <ClickAwayListener onClickAway={props.handleClose}>
                <MenuList
                    autoFocusItem={open}
                    id="composition-menu"
                    aria-labelledby="composition-button"
                    onKeyDown={props.handleListKeyDown}
                    style={{
                    }}
                >
                    <StyledMenuItem component={Link} href="/total/30" onClick={props.handleClose}>
                        {t.title[3]}
                    </StyledMenuItem>
                    <Grid container spacing={2}>
                        <Grid item xs={2.4}>
                            <StyledMenuItem component={Link} href="/total/31" onClick={props.handleClose}>お宝をあつめろ！</StyledMenuItem>

                            {
                                ce.map(n=>
                                    <StyledMenuItem key={ce} style={{
                                        borderBottom:"solid 1px "+ceColor,
                                        borderLeft:"solid 10px "+ceColor,
                                        margin:"6px 4px 0px 4px",
                                        height:"34px",
                                    }} component={Link} href={"/stage/"+n} onClick={props.handleClose}>#{n} {t.stage[n]}</StyledMenuItem>
                                )
                            }
                        </Grid>
                        <Grid item xs={2.4}>
                            <StyledMenuItem component={Link} href="/total/32" onClick={props.handleClose}>原生生物をたおせ！</StyledMenuItem>
                            {
                                be.map(n=>
                                    <StyledMenuItem key={be} style={{
                                        borderBottom:"solid 1px "+beColor,
                                        borderLeft:"solid 10px "+beColor,
                                        margin:"6px 4px 0px 4px",
                                        height:"34px",
                                    }} component={Link} href={"/stage/"+n} onClick={props.handleClose}>#{n} {t.stage[n]}</StyledMenuItem>
                                )
                            }
                        </Grid>
                        <Grid item xs={2.4}>
                            <StyledMenuItem component={Link} href="/total/33" onClick={props.handleClose}>巨大生物をたおせ！</StyledMenuItem>
                            {
                                db.map(n=>
                                    <StyledMenuItem key={db} style={{
                                        borderBottom:"solid 1px "+dbColor,
                                        borderLeft:"solid 10px "+dbColor,
                                        margin:"6px 4px 0px 4px",
                                        height:"37px",
                                    }} component={Link} href={"/stage/"+n} onClick={props.handleClose}>#{n} {t.stage[n]}</StyledMenuItem>
                                )
                            }
                        </Grid>
                        <Grid item xs={2.4}>
                            <StyledMenuItem component={Link} href="/total/34" onClick={props.handleClose}>サイドストーリー</StyledMenuItem>
                            {
                                ss.map(n=>
                                    <StyledMenuItem key={ss} style={{
                                        borderBottom:"solid 1px "+ssColor,
                                        borderLeft:"solid 10px "+ssColor,
                                        margin:"6px 4px 0px 4px",
                                        height:"37px",
                                    }} component={Link} href={"/stage/"+n} onClick={props.handleClose}>#{n} {t.stage[n]}</StyledMenuItem>
                                )
                            }
                        </Grid>
                        <Grid item xs={2.4}>
                            <StyledMenuItem component={Link} href="/total/35" onClick={props.handleClose}>ソロビンゴ</StyledMenuItem>
                            {
                                sb.map(n=>
                                    <StyledMenuItem key={sb} style={{
                                        borderBottom:"solid 1px "+sbColor,
                                        borderLeft:"solid 10px "+sbColor,
                                        margin:"6px 4px 0px 4px",
                                        height:"37px",
                                    }} component={Link} href={"/stage/"+n} onClick={props.handleClose}>#{n} {t.stage[n]}</StyledMenuItem>
                                )
                            }
                        </Grid>
                    </Grid>
                </MenuList>
            </ClickAwayListener>
        </Paper>
    )
}