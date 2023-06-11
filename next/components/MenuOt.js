import {ClickAwayListener, Grid, MenuItem, MenuList, Paper} from "@mui/material";
import * as React from "react";
import Link from "next/link";

export default function MenuOt(props){
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
                            その他
                            <MenuItem onClick={props.handleClose}>新日替わりチャレンジ</MenuItem>
                            <MenuItem component={Link} href="/keyword" onClick={props.handleClose}>ピクミンキーワード</MenuItem>
                            <MenuItem onClick={props.handleClose}>コミュニティ投票所</MenuItem>
                            <MenuItem onClick={props.handleClose}>ルール集</MenuItem>
                            <MenuItem onClick={props.handleClose}>チャレンジ複合RTA</MenuItem>
                            <MenuItem onClick={props.handleClose}>Pikmin wiki (English)</MenuItem>
                            <MenuItem onClick={props.handleClose}>SpeedRun.com</MenuItem>
                            <MenuItem onClick={props.handleClose}>Pikmin SpeedRunner Discord (English)</MenuItem>
                            <MenuItem component={Link} href="/speedrun" onClick={props.handleClose}>本編RTA</MenuItem>
                        </Grid>
                    </Grid>
                </MenuList>
            </ClickAwayListener>
        </Paper>
    )
}