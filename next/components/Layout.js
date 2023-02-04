import * as React from 'react';
import Link from "next/link";
import {Button, Container } from "@mui/material";
import HeaderMenu from "@/components/HeaderMenu";
import { styled } from '@mui/material/styles';

const OffsetContainer = styled(Container)(() => ({
    marginTop: `80px`
}));
export default function Layout({children}) {
    return (
        <>
            <HeaderMenu/>
            <OffsetContainer maxWidth="lg">
                <ul>
                    <li><Link href="/">Home</Link></li>
                    <li><Link href="/login">Login</Link></li>
                    <li><Link href="/register">Register</Link></li>
                </ul>
                <br/>
                <main>{children}</main>
            </OffsetContainer>
        </>
    )
}
