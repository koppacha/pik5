import {ClickAwayListener, Grid, MenuItem, MenuList, Paper} from "@mui/material";
import * as React from "react";
import {range} from "@/plugin/myfunction";
import {useRouter} from "next/router";
import {en} from "@/locale/en";
import {ja} from "@/locale/ja";

const ce = range(301, 315)
const be = range(316, 330)
const ss = range(331, 344)
const db = range(345, 350)
const sb = range(351, 362)

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
                        backgroundColor:"#75ff80",
                    }}
                >
                    <Grid container spacing={2}>
                        <Grid item xs={2.2}>
                            お宝をあつめろ！
                            {
                                ce.map(n=>
                                    <MenuItem onClick={props.handleClose}>#{n} {t.stage[n]}</MenuItem>
                                )
                            }
                        </Grid>
                        <Grid item xs={2.2}>
                            原生生物をたおせ！
                            {
                                be.map(n=>
                                    <MenuItem onClick={props.handleClose}>#{n} {t.stage[n]}</MenuItem>
                                )
                            }
                        </Grid>
                        <Grid item xs={2.2}>
                            巨大生物をたおせ！
                            {
                                db.map(n=>
                                    <MenuItem onClick={props.handleClose}>#{n} {t.stage[n]}</MenuItem>
                                )
                            }
                        </Grid>
                        <Grid item xs={2.2}>
                            サイドストーリー
                            {
                                ss.map(n=>
                                    <MenuItem onClick={props.handleClose}>#{n} {t.stage[n]}</MenuItem>
                                )
                            }
                        </Grid>
                        <Grid item xs={2.2}>
                            ソロビンゴ
                            {
                                sb.map(n=>
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