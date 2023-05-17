import {ClickAwayListener, Grid, MenuItem, MenuList, Paper} from "@mui/material";
import * as React from "react";

export default function MenuLm(props){
    return (
        <Paper>
            <ClickAwayListener onClickAway={props.handleClose}>
                <MenuList
                    autoFocusItem={open}
                    id="composition-menu"
                    aria-labelledby="composition-button"
                    onKeyDown={props.handleListKeyDown}
                    sx={{
                        backgroundColor:"#79a3ff",
                    }}
                >
                    <Grid container spacing={2}>
                        <Grid item xs={12}>
                            期間限定ランキング
                            <MenuItem onClick={props.handleClose}>期間限定総合ランキング</MenuItem>
                            <MenuItem onClick={props.handleClose}>大会ルールの投稿・管理</MenuItem>
                            <MenuItem onClick={props.handleClose}>ユーザー主催イベントの作成・管理</MenuItem>
                        </Grid>
                    </Grid>
                </MenuList>
            </ClickAwayListener>
        </Paper>
    )
}