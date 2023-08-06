import * as React from 'react';
import HeaderMenu from "./menu/HeaderMenu";
import Footer from "./Footer";
import {MobileMenuButton, OffsetContainer} from "../styles/pik5.css";
import {useState} from "react";
import MobileMenu from "./menu/MobileMenu";
import {FontAwesomeIcon} from "@fortawesome/react-fontawesome";
import {faAnglesLeft, faAngleUp, faHome} from "@fortawesome/free-solid-svg-icons";
import {faDiscord} from "@fortawesome/free-brands-svg-icons";
import Link from "next/link";

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
            <Link href="/">
                <MobileMenuButton style={{bottom:"0px"}}>
                    <FontAwesomeIcon icon={faHome} style={{fontSize:"30px"}} />
                </MobileMenuButton>
            </Link>
            <MobileMenuButton onClick={toggleDrawer} style={{bottom:"61px"}}>
                <FontAwesomeIcon icon={faAnglesLeft} style={{fontSize:"30px"}}/>
            </MobileMenuButton>
            <MobileMenuButton onClick={scrollToTop} style={{bottom:"122px"}}>
                <FontAwesomeIcon icon={faAngleUp} style={{fontSize:"30px"}} />
            </MobileMenuButton>
            <MobileMenu open={drawerOpen} toggleHandle={toggleDrawer}
            />
            <Link href="https://discord.gg/rQEBJQa" target="_blank">
                <MobileMenuButton style={{bottom:"183px"}}>
                    <FontAwesomeIcon icon={faDiscord} style={{fontSize:"30px"}} />
                </MobileMenuButton>
            </Link>
        </>
    )
}
