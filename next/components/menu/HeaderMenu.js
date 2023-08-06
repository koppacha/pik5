import {
    Box,
    IconButton,
    Toolbar,
    Tooltip,
    Typography,
} from "@mui/material";
import Link from "next/link";
import * as React from "react";
import {FontAwesomeIcon} from "@fortawesome/react-fontawesome";
import {faDiscord, faTwitter} from '@fortawesome/free-brands-svg-icons'
import CustomMenu from "./CustomMenu";
import {faBook, faCloudMoon, faCloudSun, faGlobe} from "@fortawesome/free-solid-svg-icons";
import {useTheme} from "next-themes";
import {useLocale} from "../../lib/pik5";
import {useRouter} from "next/router";
import {CustomMenuButton, ThinAppBar} from "../../styles/pik5.css";
import {useEffect, useState} from "react";

export default function HeaderMenu(){
    const [mounted, setMounted] = useState(false)
    const {theme, setTheme} = useTheme()
    const {t, locale} = useLocale()
    const r = (locale === "en") ? "ja" : "en"
    const router = useRouter()

    useEffect(() => {
        setMounted(true)
    }, [])

    if(!mounted){
        return null
    }
    return (
        <>
            <ThinAppBar>
                <Toolbar className="spHidden">
                    <Typography variant="h6" component="div">
                        <Link href="/">{t.title[0]}</Link>
                    </Typography>
                    <CustomMenu series={1}/>
                    <CustomMenu series={2}/>
                    <CustomMenu series={3}/>
                    <CustomMenu series={4}/>
                    {/*<CustomMenu series={5}/> 期間限定ランキングを設立したら復活*/}
                    <CustomMenu series={6}/>
                    <CustomMenuButton
                        series={7}
                        component={Link}
                        href="/keyword">
                        <FontAwesomeIcon style={{marginRight:"0.5em"}} icon={faBook} />
                        {t.g.key}
                    </CustomMenuButton>
                    <CustomMenuButton
                        series={8}
                        component={Link}
                        href="https://discord.gg/rQEBJQa">
                        <FontAwesomeIcon style={{marginRight:"0.5em"}} icon={faDiscord} />
                        {t.g.discord}
                    </CustomMenuButton>

                    {/*ここから右よせ*/}
                    <Box style={{ flexGrow: 1 }} />
                    <Tooltip title="Twitter" arrow>
                        <IconButton
                            id="twitter-button"
                            style={{color:"#fff"}}
                            href="https://twitter.com/PikminChallenge"
                            target="_blank">
                            <FontAwesomeIcon icon={faTwitter}/>
                        </IconButton>
                    </Tooltip>
                    <Tooltip title={t.g.theme} arrow>
                        <IconButton
                            id="theme-button"
                            style={{color:"#fff"}}
                            onClick={()=> setTheme(theme === "dark" ? 'light' : 'dark')}>
                            <FontAwesomeIcon icon={theme === "dark" ? faCloudSun : faCloudMoon}/>
                        </IconButton>
                    </Tooltip>
                    <Tooltip title={t.g.language} arrow>
                        <IconButton
                            component={Link}
                            href={router.asPath}
                            locale={r}
                            id="translate-button"
                            style={{color:"#fff"}}>
                            <FontAwesomeIcon icon={faGlobe} />
                        </IconButton>
                    </Tooltip>
                </Toolbar>
            </ThinAppBar>
        </>
    )
}