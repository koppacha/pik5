import {ClickAwayListener, Grid, MenuItem, MenuList, Paper} from "@mui/material";
import * as React from "react";
import Link from "next/link";
import {useLocale} from "../../lib/pik5";
import {StyledMenuItem} from "../../styles/pik5.css";

export default function MenuOt(props){

    const {t} = useLocale()
    const color = "#777777"

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
                    <Grid container spacing={2}>
                        <Grid item xs={2.4}>
                            <StyledMenuItem style={{
                                borderBottom:"solid 1px "+color,
                                borderLeft:"solid 10px "+color,
                                margin:"6px 4px 0px 4px",
                                height:"12em",
                            }}
                                component={Link} href="/keyword" onClick={props.handleClose}>{t.g.keyword}</StyledMenuItem>
                        </Grid>
                        <Grid item xs={2.4}>
                            <StyledMenuItem style={{
                                borderBottom:"solid 1px "+color,
                                borderLeft:"solid 10px "+color,
                                margin:"6px 4px 0px 4px",
                                height:"12em",
                            }}
                                            component={Link} href="/keyword/rules" onClick={props.handleClose}>{t.g.rules}</StyledMenuItem>
                        </Grid>
                        <Grid item xs={2.4}>
                            <StyledMenuItem style={{
                                borderBottom:"solid 1px "+color,
                                borderLeft:"solid 10px "+color,
                                margin:"6px 4px 0px 4px",
                                height:"12em",
                            }}
                                            component={Link} href="https://www.pikminwiki.com/" target="_blank" onClick={props.handleClose}>Pikipedia</StyledMenuItem>
                        </Grid>
                        <Grid item xs={2.4}>
                            <StyledMenuItem style={{
                                borderBottom:"solid 1px "+color,
                                borderLeft:"solid 10px "+color,
                                margin:"6px 4px 0px 4px",
                                height:"12em",
                            }}
                                            component={Link} href="https://www.speedrun.com/pikmin" target="_blank" onClick={props.handleClose}>SpeedRun.com</StyledMenuItem>
                        </Grid>
                        <Grid item xs={2.4}>
                            <StyledMenuItem style={{
                                borderBottom:"solid 1px "+color,
                                borderLeft:"solid 10px "+color,
                                margin:"6px 4px 0px 4px",
                                height:"12em",
                            }}
                                            component={Link} href="/speedrun" onClick={props.handleClose}>{t.speedrun.title}</StyledMenuItem>
                        </Grid>
                    </Grid>
                </MenuList>
            </ClickAwayListener>
        </Paper>
    )
}