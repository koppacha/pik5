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
import {Box, Container, Grid, Typography} from "@mui/material";
import MobileFooter from "./menu/MobileFooter";

export default function Layout({children}) {

    return (
        <>
            <HeaderMenu users={children?.props?.users}/>
                    <Container className="offset-container">
                        <main>{children}</main>
                    </Container>
            <Footer/>
            <MobileFooter users={children?.props?.users}/>
        </>
    )
}
