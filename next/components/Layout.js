import * as React from 'react';
import HeaderMenu from "./menu/HeaderMenu";
import Footer from "./Footer";
import {OffsetContainer} from "../styles/pik5.css";

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
