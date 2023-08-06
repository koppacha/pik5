import Link from "next/link";
import {useLocale} from "../lib/pik5";
import {Typography} from "@mui/material";
import Head from "next/head";
import * as React from "react";

export default function NotFound(){

    const {t} = useLocale()

    return (
        <>
            <Head>
                <title>{"404 Page Not Found - "+t.title[0]}</title>
            </Head>
            <div style={{height:"100vh"}}>
                <Typography className="title" variant="h2">404 Page Not Found</Typography>
                {t.t.notFound}<br/>
                <br/>
                <Link href="/">{t.g.top}</Link>
            </div>
        </>
    )
}