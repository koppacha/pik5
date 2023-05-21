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

const s401Color = "#ffde5b"
const s402Color = "#dcb724"
const s403Color = "#f3fa22"
const s404Color = "#f1d64d"
const s405Color = "#d5bb39"

export default function Menu4(props){

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
                    <MenuItem component={Link} href="/total/400" sx={{fontFamily:['"M PLUS 1 CODE"'].join(","),}} onClick={props.handleClose}>
                        {t.title[4]}
                    </MenuItem>
                    <Grid container spacing={2}>
                        <Grid item xs={2.4}>
                            <MenuItem sx={{
                                borderBottom:"solid 1px "+s401Color,
                                borderLeft:"solid 10px "+s401Color,
                                margin:"6px 4px 0px 4px",
                                height:"12em",
                                fontFamily:['"M PLUS 1 CODE"'].join(","),
                            }} component={Link} href="/stage/401">#401 {t.stage[401]}</MenuItem>
                        </Grid>
                        <Grid item xs={2.4}>
                            <MenuItem sx={{
                                borderBottom:"solid 1px "+s402Color,
                                borderLeft:"solid 10px "+s402Color,
                                margin:"6px 4px 0px 4px",
                                height:"12em",
                                fontFamily:['"M PLUS 1 CODE"'].join(","),
                            }} component={Link} href="/stage/402">#402 {t.stage[402]}</MenuItem>
                        </Grid>
                        <Grid item xs={2.4}>
                            <MenuItem sx={{
                                borderBottom:"solid 1px "+s403Color,
                                borderLeft:"solid 10px "+s403Color,
                                margin:"6px 4px 0px 4px",
                                height:"12em",
                                fontFamily:['"M PLUS 1 CODE"'].join(","),
                            }} component={Link} href="/stage/403">#403 {t.stage[403]}</MenuItem>
                        </Grid>
                        <Grid item xs={2.4}>
                            <MenuItem sx={{
                                borderBottom:"solid 1px "+s404Color,
                                borderLeft:"solid 10px "+s404Color,
                                margin:"6px 4px 0px 4px",
                                height:"12em",
                                fontFamily:['"M PLUS 1 CODE"'].join(","),
                            }} component={Link} href="/stage/404">#404 {t.stage[404]}</MenuItem>
                        </Grid>
                        <Grid item xs={2.4}>
                            <MenuItem sx={{
                                borderBottom:"solid 1px "+s405Color,
                                borderLeft:"solid 10px "+s405Color,
                                margin:"6px 4px 0px 4px",
                                height:"12em",
                                fontFamily:['"M PLUS 1 CODE"'].join(","),
                            }} component={Link} href="/stage/405">#405 {t.stage[405]}</MenuItem>
                        </Grid>
                    </Grid>
                </MenuList>
            </ClickAwayListener>
        </Paper>
    )
}