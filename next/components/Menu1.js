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
import {StyledMenuItem} from "../styles/pik5.css";

const s101Color = "#ffa35b"
const s102Color = "#dc6b24"
const s103Color = "#fa8e22"
const s104Color = "#f1c14d"
const s105Color = "#d56839"

export default function Menu1(props){

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
                    <StyledMenuItem component={Link} href="/total/10" onClick={props.handleClose}>
                        {t.title[1]}
                    </StyledMenuItem>
                    <Grid container spacing={2}>
                        <Grid item xs={2.4}>
                            <StyledMenuItem sx={{
                                borderBottom:"solid 1px "+s101Color,
                                borderLeft:"solid 10px "+s101Color,
                                margin:"6px 4px 0px 4px",
                                height:"12em",
                            }} component={Link} href="/stage/101">#101 {t.stage[101]}</StyledMenuItem>
                        </Grid>
                        <Grid item xs={2.4}>
                            <StyledMenuItem sx={{
                                borderBottom:"solid 1px "+s102Color,
                                borderLeft:"solid 10px "+s102Color,
                                margin:"6px 4px 0px 4px",
                                height:"12em",
                            }} component={Link} href="/stage/102">#102 {t.stage[102]}</StyledMenuItem>
                        </Grid>
                        <Grid item xs={2.4}>
                            <StyledMenuItem sx={{
                                borderBottom:"solid 1px "+s103Color,
                                borderLeft:"solid 10px "+s103Color,
                                margin:"6px 4px 0px 4px",
                                height:"12em",
                            }} component={Link} href="/stage/103">#103 {t.stage[103]}</StyledMenuItem>
                        </Grid>
                        <Grid item xs={2.4}>
                            <StyledMenuItem sx={{
                                borderBottom:"solid 1px "+s104Color,
                                borderLeft:"solid 10px "+s104Color,
                                margin:"6px 4px 0px 4px",
                                height:"12em",
                            }} component={Link} href="/stage/104">#104 {t.stage[104]}</StyledMenuItem>
                        </Grid>
                        <Grid item xs={2.4}>
                            <StyledMenuItem sx={{
                                borderBottom:"solid 1px "+s105Color,
                                borderLeft:"solid 10px "+s105Color,
                                margin:"6px 4px 0px 4px",
                                height:"12em",
                            }} component={Link} href="/stage/105">#105 {t.stage[105]}</StyledMenuItem>
                        </Grid>
                    </Grid>
                </MenuList>
            </ClickAwayListener>
        </Paper>
    )
}