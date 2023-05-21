import {
    Card,
    CardContent,
    CardHeader,
    ClickAwayListener,
    Grid,
    List,
    ListItem,
    MenuItem,
    MenuList,
    Paper
} from "@mui/material";
import * as React from "react";
import {range} from "@/plugin/pik5";
import {useRouter} from "next/router";
import {en} from "@/locale/en";
import {ja} from "@/locale/ja";
import Link from "next/link";

const ce = range(301, 315)
const be = range(316, 330)
const ss = range(331, 344)
const db = range(345, 350)
const sb = range(351, 362)

const ceColor = "#bdf13a"
const beColor = "#59e1a8"
const ssColor = "#35e73e"
const dbColor = "#37b3c9"
const sbColor = "#b6f153"

export default function Menu3(props){

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
                    }}
                >
                    <MenuItem component={Link} href="/total/300" sx={{fontFamily:['"M PLUS 1 CODE"'].join(","),}} onClick={props.handleClose}>
                        {t.title[3]}
                    </MenuItem>
                    <Grid container spacing={2}>
                        <Grid item xs={2.4}>
                            <MenuItem sx={{fontFamily:['"M PLUS 1 CODE"'].join(","),}} component={Link} href="/total/310" onClick={props.handleClose}>お宝をあつめろ！</MenuItem>

                            {
                                ce.map(n=>
                                    <MenuItem sx={{
                                        borderBottom:"solid 1px "+ceColor,
                                        borderLeft:"solid 10px "+ceColor,
                                        margin:"6px 4px 0px 4px",
                                        height:"34px",
                                        fontFamily:['"M PLUS 1 CODE"'].join(","),
                                    }} component={Link} href={"/stage/"+n} onClick={props.handleClose}>#{n} {t.stage[n]}</MenuItem>
                                )
                            }
                        </Grid>
                        <Grid item xs={2.4}>
                            <MenuItem sx={{fontFamily:['"M PLUS 1 CODE"'].join(","),}} component={Link} href="/total/320" onClick={props.handleClose}>原生生物をたおせ！</MenuItem>
                            {
                                be.map(n=>
                                    <MenuItem sx={{
                                        borderBottom:"solid 1px "+beColor,
                                        borderLeft:"solid 10px "+beColor,
                                        margin:"6px 4px 0px 4px",
                                        height:"34px",
                                        fontFamily:['"M PLUS 1 CODE"'].join(","),
                                    }} component={Link} href={"/stage/"+n} onClick={props.handleClose}>#{n} {t.stage[n]}</MenuItem>
                                )
                            }
                        </Grid>
                        <Grid item xs={2.4}>
                            <MenuItem sx={{fontFamily:['"M PLUS 1 CODE"'].join(","),}} component={Link} href="/total/330" onClick={props.handleClose}>巨大生物をたおせ！</MenuItem>
                            {
                                db.map(n=>
                                    <MenuItem sx={{
                                        borderBottom:"solid 1px "+dbColor,
                                        borderLeft:"solid 10px "+dbColor,
                                        margin:"6px 4px 0px 4px",
                                        height:"37px",
                                        fontFamily:['"M PLUS 1 CODE"'].join(","),
                                    }} component={Link} href={"/stage/"+n} onClick={props.handleClose}>#{n} {t.stage[n]}</MenuItem>
                                )
                            }
                        </Grid>
                        <Grid item xs={2.4}>
                            <MenuItem sx={{fontFamily:['"M PLUS 1 CODE"'].join(","),}} component={Link} href="/total/340" onClick={props.handleClose}>サイドストーリー</MenuItem>
                            {
                                ss.map(n=>
                                    <MenuItem sx={{
                                        borderBottom:"solid 1px "+ssColor,
                                        borderLeft:"solid 10px "+ssColor,
                                        margin:"6px 4px 0px 4px",
                                        height:"37px",
                                        fontFamily:['"M PLUS 1 CODE"'].join(","),
                                    }} component={Link} href={"/stage/"+n} onClick={props.handleClose}>#{n} {t.stage[n]}</MenuItem>
                                )
                            }
                        </Grid>
                        <Grid item xs={2.4}>
                            <MenuItem sx={{fontFamily:['"M PLUS 1 CODE"'].join(","),}} component={Link} href="/total/350" onClick={props.handleClose}>ソロビンゴ</MenuItem>
                            {
                                sb.map(n=>
                                    <MenuItem sx={{
                                        borderBottom:"solid 1px "+sbColor,
                                        borderLeft:"solid 10px "+sbColor,
                                        margin:"6px 4px 0px 4px",
                                        height:"37px",
                                        fontFamily:['"M PLUS 1 CODE"'].join(","),
                                    }} component={Link} href={"/stage/"+n} onClick={props.handleClose}>#{n} {t.stage[n]}</MenuItem>
                                )
                            }
                        </Grid>
                    </Grid>
                </MenuList>
            </ClickAwayListener>
        </Paper>
    )
}