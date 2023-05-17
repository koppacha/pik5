import {ClickAwayListener, Grid, MenuItem, MenuList, Paper} from "@mui/material";
import * as React from "react";
import {range} from "@/plugin/myfunction"
import {useRouter} from "next/router";
import {en} from "@/locale/en";
import {ja} from "@/locale/ja";

const ne = [203, 204, 208, 209, 210, 211, 213, 214, 215, 216, 219, 221, 222, 223, 224, 225, 227]
const eg = [201, 202, 205, 206, 207, 212, 217, 218, 220, 226, 228, 229, 230]
const du = range(231, 244)
const bt = range(245, 254)

export default function Menu2(props){

    const { locale } = useRouter();
    const t = (locale === "en") ? en : ja;

    const egColor = "#f13a49"
    const neColor = "#e17259"
    const duColor = "#e73591"
    const btColor = "#e87058"

    return (
        <Paper sx={{
            backgroundColor:"transparent",
            color:"#fff"
        }}>
            <ClickAwayListener onClickAway={props.handleClose}>
                <MenuList
                    autoFocusItem={open}
                    id="composition-menu"
                    aria-labelledby="composition-button"
                    onKeyDown={props.handleListKeyDown}
                >
                    <Grid container>
                        <Grid item xs={3} sx={{backgroundColor:"#333"}}>
                            <MenuItem>タマゴあり</MenuItem>
                            {
                                eg.map(n=>
                                    <MenuItem sx={{
                                        borderBottom:"solid 1px "+egColor,
                                        borderLeft:"solid 10px "+egColor,
                                        margin:"6px 4px",
                                        height:"37px",
                                    }} onClick={props.handleClose}>#{n} {t.stage[n]}</MenuItem>
                                )
                            }
                        </Grid>
                        <Grid item xs={3} sx={{backgroundColor:"#444"}}>
                            <MenuItem>タマゴなし</MenuItem>
                            {
                                ne.map(n=>
                                    <MenuItem sx={{
                                        borderBottom:"solid 1px "+neColor,
                                        borderLeft:"solid 10px "+neColor,
                                        margin:"4px 4px",
                                        height:"29px",
                                    }} onClick={props.handleClose}>#{n} {t.stage[n]}</MenuItem>
                                )
                            }
                        </Grid>
                        <Grid item xs={3} sx={{backgroundColor:"#333"}}>
                            <MenuItem>本編地下</MenuItem>
                            {
                                du.map(n=>
                                    <MenuItem sx={{
                                        borderBottom:"solid 1px "+duColor,
                                        borderLeft:"solid 10px "+duColor,
                                        margin:"6px 4px",
                                        height:"34px",
                                    }} onClick={props.handleClose}>#{n} {t.stage[n]}</MenuItem>
                                )
                            }
                        </Grid>
                        <Grid item xs={3} sx={{backgroundColor:"#444"}}>
                            <MenuItem>ソロバトル</MenuItem>
                            {
                                bt.map(n=>
                                    <MenuItem sx={{
                                        borderBottom:"solid 1px "+btColor,
                                        borderLeft:"solid 10px "+btColor,
                                        margin:"18px 4px",
                                        height:"37px",
                                    }} onClick={props.handleClose}>#{n} {t.stage[n]}</MenuItem>
                                )
                            }
                        </Grid>
                    </Grid>
                </MenuList>
            </ClickAwayListener>
        </Paper>
    )
}