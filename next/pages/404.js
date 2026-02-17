import Link from "next/link";
import {useLocale} from "../lib/pik5";
import {Typography} from "@mui/material";
import * as React from "react";
import SeoHead from "../components/SeoHead"

export default function NotFound(){

    const {t} = useLocale()

    return (
        <>
            <SeoHead
                title={"404 Page Not Found - "+t.title[0]}
                noindex={true}
            />
            <div style={{height:"100vh"}}>
                <Typography className="title" variant="h2">404 Page Not Found</Typography>
                {t.t.notFound}<br/>
                <br/>
                <Link href="/">{t.g.top}</Link>
            </div>
        </>
    )
}
