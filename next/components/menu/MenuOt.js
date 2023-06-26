import {ClickAwayListener, Grid, MenuItem, MenuList, Paper} from "@mui/material";
import * as React from "react";
import Link from "next/link";
import {useLocale} from "../../lib/pik5";

export default function MenuOt(props){

    const {t} = useLocale()

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
                        <Grid item xs={12}>
                            <MenuItem component={Link} href="/keyword" onClick={props.handleClose}>{t.g.keyword}</MenuItem>
                            <MenuItem onClick={props.handleClose}>コミュニティ投票所</MenuItem>
                            <MenuItem component={Link} href="/keyword/rules" onClick={props.handleClose}>{t.g.rules}</MenuItem>
                            <MenuItem onClick={props.handleClose}>チャレンジ複合RTA</MenuItem>
                            <MenuItem onClick={props.handleClose}>Pikmin wiki (English)</MenuItem>
                            <MenuItem onClick={props.handleClose}>SpeedRun.com</MenuItem>
                            <MenuItem onClick={props.handleClose}>Pikmin SpeedRunner Discord (English)</MenuItem>
                            <MenuItem component={Link} href="/speedrun" onClick={props.handleClose}>{t.speedrun.title}</MenuItem>
                        </Grid>
                    </Grid>
                </MenuList>
            </ClickAwayListener>
        </Paper>
    )
}