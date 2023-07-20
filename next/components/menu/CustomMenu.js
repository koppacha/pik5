import {useRef, useState} from "react";
import {Button, Fade, Popper} from "@mui/material";
import * as React from "react";
import Menu2 from "./Menu2";
import Menu1 from "./Menu1";
import Menu3 from "./Menu3";
import Menu4 from "./Menu4";
import MenuLm from "./MenuLm";
import MenuOt from "./MenuOt";
import {useLocale} from "../../lib/pik5";
import {CustomMenuButton} from "../../styles/pik5.css";
import MenuSpeedrun from "./MenuSpeedrun";

export default function CustomMenu(props){

    const {t} = useLocale()

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
        else if(s === 6){
            return (
                <MenuSpeedrun
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
            <CustomMenuButton
                series={props.series}
                ref={anchorEl}
                onClick={handleClick}>
                {t.title[props.series]}
            </CustomMenuButton>
            <Popper
                id="total-menu"
                anchorEl={anchorEl.current}
                role={undefined}
                open={open}
                placement="bottom-end"
                transition
                disablePortal
                style={{
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