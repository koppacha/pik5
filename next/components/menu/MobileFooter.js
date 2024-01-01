import {MobileFooterItem, MobileFooterMenu} from "../../styles/pik5.css";
import Link from "next/link";
import {FontAwesomeIcon} from "@fortawesome/react-fontawesome";
import {faAnglesLeft, faAngleUp, faHome, faMagnifyingGlass} from "@fortawesome/free-solid-svg-icons";
import {ListItemButton, Typography} from "@mui/material";
import {faDiscord} from "@fortawesome/free-brands-svg-icons";
import * as React from "react";
import MobileMenu from "./MobileMenu";
import {useRef, useState} from "react";
import ModalSearch from "../modal/ModalSearch";

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

    const searchRef = useRef(null)
    const [searchOpen, setSearchOpen] = useState(false)

    const handleSearchClick = () => {
        setSearchOpen(true)
    }
    const handleSearchClose = () => {
        setSearchOpen(false)
    }

    return (
        <>
            <MobileFooterMenu container columns={{xs: 5}}>
                <MobileFooterItem item xs={1}>
                    <Link href="/">
                        <span>
                            <FontAwesomeIcon icon={faHome}/>
                            <Typography>Home</Typography>
                        </span>
                    </Link>
                </MobileFooterItem>
                <MobileFooterItem item xs={1}>
                    <Link href="https://discord.gg/rQEBJQa" target="_blank">
                        <span>
                            <FontAwesomeIcon icon={faDiscord}/>
                            <Typography>Discord</Typography>
                        </span>
                    </Link>
                </MobileFooterItem>
                <MobileFooterItem item xs={1} onClick={handleSearchClick} style={{cursor:"pointer"}}>
                    <FontAwesomeIcon icon={faMagnifyingGlass}/>
                    <Typography>Search</Typography>
                </MobileFooterItem>
                <MobileFooterItem item xs={1} onClick={scrollToTop} style={{cursor:"pointer"}}>
                    <FontAwesomeIcon icon={faAngleUp}/>
                    <Typography>PageTop</Typography>
                </MobileFooterItem>
                <MobileFooterItem item xs={1} onClick={toggleDrawer} style={{cursor:"pointer"}}>
                    <FontAwesomeIcon icon={faAnglesLeft}/>
                    <Typography>Menu</Typography>
                </MobileFooterItem>
            </MobileFooterMenu>
            <MobileMenu users={users} open={drawerOpen} toggleHandle={toggleDrawer}/>
            <ModalSearch users={users} open={searchOpen} handleClose={handleSearchClose} searchRef={searchRef}/>
        </>
    )
}