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
                    <li><Link href="/stage/201">こてしらべの洞窟</Link></li>
                    <li><Link href="/stage/202">新参者の試練場</Link></li>
                    <li><Link href="/stage/203">神々のおもちゃ箱</Link></li>
                </ul>
                <br/>
                <main>{children}</main>
            </OffsetContainer>
        </>
    )
}
