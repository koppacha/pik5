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
import {faBook, faCloudMoon, faCloudSun, faDice, faGlobe, faMagnifyingGlass} from "@fortawesome/free-solid-svg-icons";
import {useTheme} from "next-themes";
import {useLocale} from "../../lib/pik5";
import {useRouter} from "next/router";
import {CustomMenuButton, LeftAppBar, ThinAppBar} from "../../styles/pik5.css";
import {useEffect, useRef, useState} from "react";
import ModalSearch from "../modal/ModalSearch";
import {p0} from "../../lib/const";

export default function HeaderMenu({users}){
    const [mounted, setMounted] = useState(false)
    const [searchOpen, setSearchOpen] = useState(false)
    const searchRef = useRef(null)
    const {theme, setTheme} = useTheme()
    const {t, locale} = useLocale()
    const r = (locale === "en") ? "ja" : "en"
    const router = useRouter()

    const handleSearchClick = () => {
        setSearchOpen(true)
    }

    const handleSearchClose = () => {
        setSearchOpen(false)
    }

    function handleRandomClick(){
        const targetStageId = p0[Math.floor(Math.random() * p0.length)]
        router.push(`/stage/${targetStageId}`).then(r => (!r) && console.log("Response Error from Header Menu"))
    }

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
                    <LeftAppBar>
                        <CustomMenu series={0}/>
                        <CustomMenu series={1}/>
                        <CustomMenu series={2}/>
                        <CustomMenu series={3}/>
                        <CustomMenu series={4}/>
                        <CustomMenu series={5}/>
                        <CustomMenu series={6}/>
                        <CustomMenu series={9}/>
                        <CustomMenuButton
                            series={7}
                            component={Link}
                            href="/keyword">
                            <span>
                                <FontAwesomeIcon style={{marginRight:"0.5em"}} icon={faBook} />
                                {t.g.key}
                            </span>
                        </CustomMenuButton>
                    </LeftAppBar>

                    {/*ここから右よせ*/}
                    <Box style={{ flexGrow: 1 }} />
                    <Tooltip title={t.g.discord} arrow>
                        <IconButton
                            id="discord-button"
                            className="icon-button"
                            href="https://discord.gg/rQEBJQa">
                            <FontAwesomeIcon icon={faDiscord}/>
                        </IconButton>
                    </Tooltip>
                    <Tooltip title="ランダム選出" arrow>
                        <IconButton
                            id="random-button"
                            className="icon-button"
                            onClick={handleRandomClick}>
                            <FontAwesomeIcon icon={faDice}/>
                        </IconButton>
                    </Tooltip>
                    <Tooltip title="検索" arrow>
                        <IconButton
                            id="search-button"
                            className="icon-button"
                            onClick={handleSearchClick}>
                            <FontAwesomeIcon icon={faMagnifyingGlass}/>
                        </IconButton>
                    </Tooltip>
                    <Tooltip title="Twitter" arrow>
                        <IconButton
                            id="twitter-button"
                            className="icon-button"
                            href="https://twitter.com/PikminChallenge"
                            target="_blank">
                            <FontAwesomeIcon icon={faTwitter}/>
                        </IconButton>
                    </Tooltip>
                    <Tooltip title={t.g.theme} arrow>
                        <IconButton
                            id="theme-button"
                            className="icon-button"
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
                            className="icon-button">
                            <FontAwesomeIcon icon={faGlobe} />
                        </IconButton>
                    </Tooltip>
                </Toolbar>
            </ThinAppBar>
            <ModalSearch users={users} open={searchOpen} handleClose={handleSearchClose} searchRef={searchRef}/>
        </>
    )
}