import * as React from 'react';
import HeaderMenu from "./menu/HeaderMenu";
import Footer from "./Footer";
import {MobileFooterItem, MobileFooterMenu, MobileMenuButton, OffsetContainer} from "../styles/pik5.css";
import {useState} from "react";
import MobileMenu from "./menu/MobileMenu";
import {FontAwesomeIcon} from "@fortawesome/react-fontawesome";
import {faAnglesLeft, faAngleUp, faHome} from "@fortawesome/free-solid-svg-icons";
import {faDiscord} from "@fortawesome/free-brands-svg-icons";
import Link from "next/link";
import {Box, Grid} from "@mui/material";

export default function Layout({children}) {

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
            <HeaderMenu/>
                    <OffsetContainer>
                        <main>{children}</main>
                    </OffsetContainer>
            <Footer/>
            <MobileFooterMenu container columns={{xs: 4}}>
                <MobileFooterItem item xs={1}>
                    <Link href="/">
                        <FontAwesomeIcon icon={faHome} style={{fontSize:"28px"}} /><br/>
                        home
                    </Link>
                </MobileFooterItem>
                <MobileFooterItem item xs={1}>
                    <Link href="https://discord.gg/rQEBJQa" target="_blank">
                        <FontAwesomeIcon icon={faDiscord} style={{fontSize:"28px"}} /><br/>
                        Discord
                    </Link>
                </MobileFooterItem>
                <MobileFooterItem item xs={1} onClick={scrollToTop}>
                    <FontAwesomeIcon icon={faAngleUp} style={{fontSize:"30px"}} /><br/>
                    pageTop
                </MobileFooterItem>
                <MobileFooterItem item xs={1} onClick={toggleDrawer}>
                    <FontAwesomeIcon icon={faAnglesLeft} style={{fontSize:"30px"}}/><br/>
                    menu
                </MobileFooterItem>
            </MobileFooterMenu>
            <MobileMenu open={drawerOpen} toggleHandle={toggleDrawer}
            />
        </>
    )
}
