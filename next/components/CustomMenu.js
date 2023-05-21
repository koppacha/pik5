import {useRef, useState} from "react";
import {Button, Fade, Popper} from "@mui/material";
import {AccountCircle} from "@mui/icons-material";
import * as React from "react";
import Menu2 from "@/components/Menu2";
import Menu1 from "@/components/Menu1";
import Menu3 from "@/components/Menu3";
import Menu4 from "@/components/Menu4";
import MenuLm from "@/components/MenuLm";
import MenuOt from "@/components/MenuOt";
import {en} from "@/locale/en";
import {ja} from "@/locale/ja";
import {useRouter} from "next/router";
import Link from "next/link";

export default function CustomMenu(props){

    const { locale } = useRouter();
    const t = (locale === "en") ? en : ja;

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
    function menuObject(s){
        if(s === 1){
            return (
                <Menu1
                    handleListKeyDown={handleListKeyDown}
                    handleClose={handleClose}/>
            )
        }
        else if(s === 2){
            return (
                <Menu2
                    handleListKeyDown={handleListKeyDown}
                    handleClose={handleClose}/>
            )
        }
        else if(s === 3){
            return (
                <Menu3
                    handleListKeyDown={handleListKeyDown}
                    handleClose={handleClose}/>
            )
        }
        else if(s === 4){
            return (
                <Menu4
                    handleListKeyDown={handleListKeyDown}
                    handleClose={handleClose}/>
            )
        }
        else if(s === 7){
            return (
                <MenuLm
                    handleListKeyDown={handleListKeyDown}
                    handleClose={handleClose}/>
            )
        }
        else if(s === 9){
            return (
                <MenuOt
                    handleListKeyDown={handleListKeyDown}
                    handleClose={handleClose}/>
            )
        }
    }

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
                    <Fade
                        {...TransitionProps}
                    >
                        <div>
                            {menuObject(props.series)}
                        </div>
                    </Fade>
                )}
            </Popper>
        </>
    )
}