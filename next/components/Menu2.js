import {
    Box, Card,
    CardContent,
    CardHeader,
    ClickAwayListener,
    Grid, List, ListItem,
    MenuItem,
    MenuList,
    Paper,
} from "@mui/material";
import * as React from "react";
import {range} from "@/plugin/pik5"
import {useRouter} from "next/router";
import {en} from "@/locale/en";
import {ja} from "@/locale/ja";
import Link from "next/link";
import Button from "@mui/material/Button";
import {StyledMenuItem} from "../styles/pik5.css"
import {useLocale} from "../plugin/pik5";

const ne = [203, 204, 208, 209, 210, 211, 213, 214, 215, 216, 219, 221, 222, 223, 224, 225, 227]
const eg = [201, 202, 205, 206, 207, 212, 217, 218, 220, 226, 228, 229, 230]
const du = range(231, 244)
const bt = range(245, 254)

export default function Menu2(props){

    const {t} = useLocale()

    const egColor = "#f13a49"
    const neColor = "#e17259"
    const duColor = "#e73591"
    const btColor = "#e87058"

    return (
        <Paper style={{
        }}>
            <ClickAwayListener onClickAway={props.handleClose}>
                <MenuList
                    autoFocusItem={open}
                    id="composition-menu"
                    aria-labelledby="composition-button"
                    onKeyDown={props.handleListKeyDown}
                >
                    <StyledMenuItem component={Link} href="/total/20" onClick={props.handleClose}>
                        {t.title[2]}
                    </StyledMenuItem>
                    <Grid container>
                        <Grid item xs={3}>
                            <StyledMenuItem component={Link} href="/total/21" onClick={props.handleClose}>タマゴあり</StyledMenuItem>
                            {
                                eg.map(n=>
                                    <StyledMenuItem style={{
                                        borderBottom:"solid 1px "+egColor,
                                        borderLeft:"solid 10px "+egColor,
                                        margin:"6px 4px 0px 4px",
                                        height:"37px",
                                    }} component={Link} href={"/stage/"+n} onClick={props.handleClose}>#{n} {t.stage[n]}</StyledMenuItem>
                                )
                            }
                        </Grid>
                        <Grid item xs={3}>
                            <StyledMenuItem component={Link} href="/total/22" onClick={props.handleClose}>タマゴなし</StyledMenuItem>
                            {
                                ne.map(n=>
                                    <StyledMenuItem style={{
                                        borderBottom:"solid 1px "+neColor,
                                        borderLeft:"solid 10px "+neColor,
                                        margin:"4px 4px",
                                        height:"29px",
                                    }} component={Link} href={"/stage/"+n} onClick={props.handleClose}>#{n} {t.stage[n]}</StyledMenuItem>
                                )
                            }
                        </Grid>
                        <Grid item xs={3}>
                            <StyledMenuItem component={Link} href="/total/23" onClick={props.handleClose}>本編地下</StyledMenuItem>
                            {
                                du.map(n=>
                                    <StyledMenuItem style={{
                                        borderBottom:"solid 1px "+duColor,
                                        borderLeft:"solid 10px "+duColor,
                                        margin:"6px 4px",
                                        height:"34px",
                                    }} component={Link} href={"/stage/"+n} onClick={props.handleClose}>#{n} {t.stage[n]}</StyledMenuItem>
                                )
                            }
                        </Grid>
                        <Grid item xs={3}>
                            <StyledMenuItem component={Link} href="/total/24" onClick={props.handleClose}>ソロバトル</StyledMenuItem>
                            {
                                bt.map(n=>
                                    <StyledMenuItem style={{
                                        borderBottom:"solid 1px "+btColor,
                                        borderLeft:"solid 10px "+btColor,
                                        margin:"18px 4px",
                                        height:"34px",
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