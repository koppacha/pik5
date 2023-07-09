import * as React from 'react';
import HeaderMenu from "./menu/HeaderMenu";
import Footer from "./Footer";
import {MobileMenuButton, OffsetContainer} from "../styles/pik5.css";
import {useState} from "react";
import MobileMenu from "./menu/MobileMenu";
import {FontAwesomeIcon} from "@fortawesome/react-fontawesome";
import {faAnglesLeft} from "@fortawesome/free-solid-svg-icons";

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

    return (
        <>
            <HeaderMenu/>
                    <OffsetContainer maxWidth="lg">
                        <main>{children}</main>
                    </OffsetContainer>
            <Footer/>
            <MobileMenuButton onClick={toggleDrawer}><FontAwesomeIcon icon={faAnglesLeft} />menu</MobileMenuButton>
            <MobileMenu open={drawerOpen} toggleHandle={toggleDrawer}/>
        </>
    )
}
