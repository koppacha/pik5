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
import Link from "next/link";
import Button from "@mui/material/Button";
import {HeaderPopMenu, StyledMenuItem} from "../../styles/pik5.css"
import {useLocale} from "../../lib/pik5";
import {eg, ne, du, bt} from "../../lib/const";

export default function Menu2(props){

    const {t} = useLocale()

    const egColor = "#f13a49"
    const neColor = "#e17259"
    const duColor = "#e73591"
    const btColor = "#e87058"

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
                        <Grid item xs={3}>
                            <StyledMenuItem style={{
                                borderLeft:"solid 10px "+egColor,
                            }} component={Link} href="/total/21" onClick={props.handleClose}>タマゴあり総合</StyledMenuItem>
                            {
                                eg.map(n=>
                                    <StyledMenuItem key={n} style={{
                                        borderLeft:"solid 10px "+egColor,
                                    }} component={Link} href={"/stage/"+n} onClick={props.handleClose}>#{n} {t.stage[n]}</StyledMenuItem>
                                )
                            }
                        </Grid>
                        <Grid item xs={3}>
                            <StyledMenuItem style={{
                                borderLeft:"solid 10px "+neColor,
                            }} component={Link} href="/total/22" onClick={props.handleClose}>タマゴなし総合</StyledMenuItem>
                            {
                                ne.map(n=>
                                    <StyledMenuItem key={n} style={{
                                        borderLeft:"solid 10px "+neColor,
                                    }} component={Link} href={"/stage/"+n} onClick={props.handleClose}>#{n} {t.stage[n]}</StyledMenuItem>
                                )
                            }
                        </Grid>
                        <Grid item xs={3}>
                            <StyledMenuItem style={{
                                borderLeft:"solid 10px "+duColor,
                            }}  component={Link} href="/total/23" onClick={props.handleClose}>本編地下総合</StyledMenuItem>
                            {
                                du.map(n=>
                                    <StyledMenuItem key={n} style={{
                                        borderLeft:"solid 10px "+duColor,
                                    }} component={Link} href={"/stage/"+n} onClick={props.handleClose}>#{n} {t.stage[n]}</StyledMenuItem>
                                )
                            }
                        </Grid>
                        <Grid item xs={3}>
                            <StyledMenuItem style={{
                                borderLeft:"solid 10px "+btColor,
                            }}  component={Link} href="/total/24" onClick={props.handleClose}>ソロバトル総合</StyledMenuItem>
                            {
                                bt.map(n=>
                                    <StyledMenuItem key={n} style={{
                                        borderLeft:"solid 10px "+btColor,
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