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
import {StyledMenuItem} from "../../styles/pik5.css"
import {useLocale} from "../../lib/pik5";
import {eg, ne, du, bt} from "../../lib/const";

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