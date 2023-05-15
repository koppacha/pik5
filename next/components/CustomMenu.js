import {useRef, useState} from "react";
import {Box, Button, ClickAwayListener, Grid, Grow, Menu, MenuItem, MenuList, Paper, Popper} from "@mui/material";
import {useRouter} from "next/router";
import {en} from "@/locale/en";
import {ja} from "@/locale/ja";
import CustomMenuItems from "@/components/CustomMenuItems";
import {AccountCircle} from "@mui/icons-material";
import * as React from "react";

export default function CustomMenu(props){

    // プルダウンメニュー駆動周り
    const anchorEl = useRef(null)
    const [open, setOpen] = useState(false)

    const handleClick = (event) => {
        setOpen(!open);
    };
    const handleClose = (e) => {
        if(
            anchorEl.current &&
            anchorEl.current.contains(e.target)
        ) {
            return;
        }
        setOpen(false);
    };
    function handleListKeyDown(e){
        if(e.key === "Tab"){
            e.preventDefault()
            setOpen(false)
        } else if (e.key === "Escape"){
            setOpen(false)
        }
    }
    const { locale } = useRouter();
    const t = (locale === "en") ? en : ja;

    const noEgg = [203, 204, 208, 209, 210, 211, 213, 214, 215, 216, 219, 221, 222, 223, 224, 225, 227]
    const egg = [201, 202, 205, 206, 207, 212, 217, 218, 220, 226, 228, 229, 230]

    return (
        <>
            <Button
                sx={{
                    color:'#fff',
                    backgroundColor:'transparent',
                    fontSize: '0.9em'
            }}
                id="basic-button"
                ref={anchorEl}
                variant="contained"
                onClick={handleClick}>
                {props.series < 10
                    ? t.title[props.series]
                    : <AccountCircle />
                }
            </Button>
            <Popper
                id="total-menu"
                anchorEl={anchorEl.current}
                role={undefined}
                open={open}
                placement="bottom-end"
                transition
                disablePortal
                sx={{
                    width:"100%",
                }}
            >
                {({ TransitionProps, placement }) => (
                    <Grow
                        {...TransitionProps}
                        style={{
                            transformOrigin: "top"
                        }}
                    >
                        <Paper>
                            <ClickAwayListener onClickAway={handleClose}>
                                <MenuList
                                    autoFocusItem={open}
                                    id="composition-menu"
                                    aria-labelledby="composition-button"
                                    onKeyDown={handleListKeyDown}
                                    sx={{
                                        backgroundColor:"#eee",
                                    }}
                                    >
                                    <Grid container spacing={2}>
                                        <Grid item xs={3}>
                                            タマゴあり
                                            {
                                                egg.map(n=>
                                                    <MenuItem onClick={handleClose}>#{n} {t.stage[n]}</MenuItem>
                                                )
                                            }
                                        </Grid>
                                        <Grid item xs={3}>
                                            タマゴなし
                                            {
                                                noEgg.slice(0,13).map(n=>
                                                    <MenuItem onClick={handleClose}>#{n} {t.stage[n]}</MenuItem>
                                                )
                                            }
                                        </Grid>
                                        <Grid item xs={3}>
                                            タマゴなし
                                            {
                                                noEgg.slice(13).map(n=>
                                                    <MenuItem onClick={handleClose}>#{n} {t.stage[n]}</MenuItem>
                                                )
                                            }

                                            本編地下
                                            <MenuItem onClick={handleClose}>メニュー1</MenuItem>
                                            <MenuItem onClick={handleClose}>メニュー2</MenuItem>
                                            <MenuItem onClick={handleClose}>メニュー3</MenuItem>
                                            <MenuItem onClick={handleClose}>メニュー4</MenuItem>
                                            <MenuItem onClick={handleClose}>メニュー5</MenuItem>
                                            <MenuItem onClick={handleClose}>メニュー6</MenuItem>
                                            <MenuItem onClick={handleClose}>メニュー7</MenuItem>
                                        </Grid>
                                        <Grid item xs={3}>
                                            本編地下
                                            <MenuItem onClick={handleClose}>メニュー8</MenuItem>
                                            <MenuItem onClick={handleClose}>メニュー9</MenuItem>
                                            <MenuItem onClick={handleClose}>メニュー10</MenuItem>
                                            <MenuItem onClick={handleClose}>メニュー11</MenuItem>
                                            <MenuItem onClick={handleClose}>メニュー12</MenuItem>
                                            <MenuItem onClick={handleClose}>メニュー13</MenuItem>
                                            <MenuItem onClick={handleClose}>メニュー14</MenuItem>
                                        </Grid>
                                    </Grid>
                                </MenuList>
                            </ClickAwayListener>
                        </Paper>
                    </Grow>
                )}
            </Popper>
        </>
    )
}