import {ClickAwayListener, Grid, MenuItem, MenuList, Paper} from "@mui/material";
import * as React from "react";
import Link from "next/link";
import {useLocale} from "../../lib/pik5";
import {StyledMenuItem} from "../../styles/pik5.css";

export default function MenuSpeedrun(props){

    const {t} = useLocale()
    const color = "#777777"
    const speedruns = [101, 102, 201, 202, 203, 204, 301, 302, 303, 311, 312, 313]

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
                    {
                        speedruns.map(stageId =>
                            <Grid item xs={2}>
                                <StyledMenuItem style={{
                                    borderBottom:"solid 1px "+color,
                                    borderLeft:"solid 10px "+color,
                                    margin:"6px 4px 0px 4px",
                                    height:"12em",
                                }}
                                                component={Link} href={"/speedrun/"+stageId} onClick={props.handleClose}>{t.speedrun[stageId]}</StyledMenuItem>
                            </Grid>
                        )
                    }
                    </Grid>
                </MenuList>
            </ClickAwayListener>
        </Paper>
    )
}