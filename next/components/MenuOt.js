import {ClickAwayListener, Grid, MenuItem, MenuList, Paper} from "@mui/material";
import * as React from "react";

export default function MenuOt(props){
    return (
        <Paper>
            <ClickAwayListener onClickAway={props.handleClose}>
                <MenuList
                    autoFocusItem={open}
                    id="composition-menu"
                    aria-labelledby="composition-button"
                    onKeyDown={props.handleListKeyDown}
                    sx={{
                        backgroundColor:"#9e77ff",
                    }}
                >
                    <Grid container spacing={2}>
                        <Grid item xs={12}>
                            その他
                            <MenuItem onClick={props.handleClose}>新日替わりチャレンジ</MenuItem>
                            <MenuItem onClick={props.handleClose}>ピクミンキーワード</MenuItem>
                            <MenuItem onClick={props.handleClose}>コミュニティ投票所</MenuItem>
                            <MenuItem onClick={props.handleClose}>ルール集</MenuItem>
                            <MenuItem onClick={props.handleClose}>チャレンジ複合RTA</MenuItem>
                            <MenuItem onClick={props.handleClose}>Pikmin wiki (English)</MenuItem>
                            <MenuItem onClick={props.handleClose}>Speedrun.com</MenuItem>
                            <MenuItem onClick={props.handleClose}>Pikmin Speedrunner (English)</MenuItem>
                        </Grid>
                    </Grid>
                </MenuList>
            </ClickAwayListener>
        </Paper>
    )
}