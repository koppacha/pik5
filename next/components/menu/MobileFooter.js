import {MobileFooterItem, MobileFooterMenu} from "../../styles/pik5.css";
import Link from "next/link";
import {FontAwesomeIcon} from "@fortawesome/react-fontawesome";
import {faAnglesLeft, faAngleUp, faHome} from "@fortawesome/free-solid-svg-icons";
import {Typography} from "@mui/material";
import {faDiscord} from "@fortawesome/free-brands-svg-icons";
import * as React from "react";
import MobileMenu from "./MobileMenu";
import {useState} from "react";

export default function MobileFooter({users}){

    // ドロワー管理用変数
    const [drawerOpen, setDrawerOpen] = useState(false)

    const toggleDrawer = () => {
        if(!drawerOpen) {
            setDrawerOpen(true)
        } else {
            setDrawerOpen(false)
        }
    }

    const scrollToTop = () => {
        window.scrollTo({
            top: 0,
            behavior: "smooth",
        })
    }

    return (
        <>
            <MobileFooterMenu container columns={{xs: 4}}>
                <MobileFooterItem item xs={1}>
                    <Link href="/">
                        <FontAwesomeIcon icon={faHome} style={{fontSize:"24px"}} /><br/>
                        <Typography style={{fontSize:"0.85em"}}>Home</Typography>
                    </Link>
                </MobileFooterItem>
                <MobileFooterItem item xs={1}>
                    <Link href="https://discord.gg/rQEBJQa" target="_blank">
                        <FontAwesomeIcon icon={faDiscord} style={{fontSize:"24px"}} /><br/>
                        <Typography style={{fontSize:"0.85em"}}>Discord</Typography>
                    </Link>
                </MobileFooterItem>
                <MobileFooterItem item xs={1} onClick={scrollToTop}>
                    <FontAwesomeIcon icon={faAngleUp} style={{fontSize:"24px"}} /><br/>
                    <Typography style={{fontSize:"0.85em"}}>PageTop</Typography>
                </MobileFooterItem>
                <MobileFooterItem item xs={1} onClick={toggleDrawer}>
                    <FontAwesomeIcon icon={faAnglesLeft} style={{fontSize:"24px"}}/><br/>
                    <Typography style={{fontSize:"0.85em"}}>Menu</Typography>
                </MobileFooterItem>
            </MobileFooterMenu>
            <MobileMenu users={users} open={drawerOpen} toggleHandle={toggleDrawer}/>
        </>
    )
}