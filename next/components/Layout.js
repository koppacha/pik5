import * as React from 'react';
import Link from "next/link";
import {Button, Container } from "@mui/material";
import HeaderMenu from "@/components/HeaderMenu";
import styled from "styled-components";
import Footer from "./Footer";

const OffsetContainer = styled(Container)(() => ({
    marginTop: `80px`
}));
export default function Layout({children}) {
    return (
        <>
            <HeaderMenu/>
            <OffsetContainer maxWidth="lg">
                <main>{children}</main>
            </OffsetContainer>
            <Footer/>
        </>
    )
}
