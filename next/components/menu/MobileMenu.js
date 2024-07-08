import {Box, Collapse, IconButton, List, ListItem, ListItemButton, SwipeableDrawer} from "@mui/material";
import * as React from "react";
import {CustomListItemButton, MobileMenuBox} from "../../styles/pik5.css";
import {p1, ne, eg, du, bt, ce, be, ss, db, sb, sp, dc, dd, ex, ot} from "../../lib/const"
import {useLocale} from "../../lib/pik5";
import {useRef, useState} from "react";
import {faDiscord, faTwitter} from "@fortawesome/free-brands-svg-icons";
import {FontAwesomeIcon} from "@fortawesome/react-fontawesome";
import {
    faCloudMoon,
    faCloudSun,
    faGlobe,
    faAngleUp,
    faAngleDown,
    faMagnifyingGlass
} from "@fortawesome/free-solid-svg-icons";
import {useRouter} from "next/router";
import {useTheme} from "next-themes";
import ModalSearch from "../modal/ModalSearch";

export default function MobileMenu({users, open, toggleHandle}){

    const {t, r} = useLocale()
    const router = useRouter()
    const {theme, setTheme} = useTheme()

    const flag = Number(router?.query?.stage?.[0]) || 0
    const runFlag = Number(router?.query?.run?.[0]) || 0

    const [openP1, setOpenP1] = useState(p1.includes(flag))
    const [openNE, setOpenNE] = useState(ne.includes(flag))
    const [openEG, setOpenEG] = useState(eg.includes(flag))
    const [openDU, setOpenDU] = useState(du.includes(flag))
    const [openBT, setOpenBT] = useState(bt.includes(flag))
    const [openCE, setOpenCE] = useState(ce.includes(flag))
    const [openBE, setOpenBE] = useState(be.includes(flag))
    const [openSS, setOpenSS] = useState(ss.includes(flag))
    const [openDB, setOpenDB] = useState(db.includes(flag))
    const [openSB, setOpenSB] = useState(sb.includes(flag))
    const [openDC, setOpenDC] = useState(dc.includes(flag))
    const [openDD, setOpenDD] = useState(dd.includes(flag))
    const [openEX, setOpenEX] = useState(ex.includes(flag))
    const [openSP, setOpenSP] = useState(sp.includes(runFlag))
    const [openOT, setOpenOT] = useState(ot.includes(flag))

    const handleClickP1 = () => setOpenP1(!openP1)
    const handleClickNE = () => setOpenNE(!openNE)
    const handleClickEG = () => setOpenEG(!openEG)
    const handleClickDU = () => setOpenDU(!openDU)
    const handleClickBT = () => setOpenBT(!openBT)
    const handleClickCE = () => setOpenCE(!openCE)
    const handleClickBE = () => setOpenBE(!openBE)
    const handleClickSS = () => setOpenSS(!openSS)
    const handleClickDB = () => setOpenDB(!openDB)
    const handleClickSB = () => setOpenSB(!openSB)
    const handleClickDC = () => setOpenDC(!openDC)
    const handleClickDD = () => setOpenDD(!openDD)
    const handleClickEX = () => setOpenEX(!openEX)
    const handleClickSP = () => setOpenSP(!openSP)
    const handleClickOT = () => setOpenOT(!openOT)

    const items = [
        { onClick: handleClickP1, title: t.title[1], subtitle: "", open: openP1, stages: p1 },
        { onClick: handleClickEG, title: t.title[2], subtitle: t.subtitle[21], open: openEG, stages: eg },
        { onClick: handleClickNE, title: t.title[2], subtitle: t.subtitle[22], open: openNE, stages: ne },
        { onClick: handleClickDU, title: t.title[2], subtitle: t.subtitle[25], open: openDU, stages: du },
        { onClick: handleClickBT, title: t.title[2], subtitle: t.subtitle[29], open: openBT, stages: bt },
        { onClick: handleClickCE, title: t.title[3], subtitle: t.subtitle[31], open: openCE, stages: ce },
        { onClick: handleClickBE, title: t.title[3], subtitle: t.subtitle[32], open: openBE, stages: be },
        { onClick: handleClickSS, title: t.title[3], subtitle: t.subtitle[36], open: openSS, stages: ss },
        { onClick: handleClickDB, title: t.title[3], subtitle: t.subtitle[33], open: openDB, stages: db },
        { onClick: handleClickSB, title: t.title[3], subtitle: t.subtitle[35], open: openSB, stages: sb },
        { onClick: handleClickDC, title: t.title[4], subtitle: t.subtitle[41], open: openDC, stages: dc },
        { onClick: handleClickDD, title: t.title[4], subtitle: t.subtitle[42], open: openDD, stages: dd },
        { onClick: handleClickEX, title: t.title[4], subtitle: t.subtitle[43], open: openEX, stages: ex },
        { onClick: handleClickSP, title: t.speedrun.title, subtitle: "", open: openSP, stages: sp },
        { onClick: handleClickOT, title: t.title[9], subtitle: "", open: openOT, stages: ot },
    ];

    function MobileMenuItems(){
        return (
            items.map((item, index) => (
                <React.Fragment key={index}>
                    <ListItemButton onClick={item.onClick} divider={true}>
                        {item.title} {item.subtitle}　
                        {item.open ? <FontAwesomeIcon icon={faAngleUp}/> : <FontAwesomeIcon icon={faAngleDown}/>}
                    </ListItemButton>
                    <Collapse in={item.open} timeout="auto" unmountOnExit>
                        <List>
                            {item.stages.map(stage => (
                                <ListItemButton key={stage} href={"/stage/"+stage} divider={true}>
                                    #{stage} {t.stage[stage]}
                                </ListItemButton>
                            ))}
                        </List>
                    </Collapse>
                </React.Fragment>
            ))
        )
    }

    return (
        <>
        <SwipeableDrawer
            anchor="right"
            open={open}
            onClose={toggleHandle}
            onOpen={toggleHandle}
        >
            <MobileMenuBox
                role="presentation"
            >
                <List>
                    <MobileMenuItems/>
                    <br/>
                    <ListItemButton divider={true} href="/"><span>{t.g.top}</span></ListItemButton>
                    <ListItemButton divider={true} href="/keyword"><span>{t.g.keyword}</span></ListItemButton>
                    <ListItemButton divider={true} href="https://discord.gg/rQEBJQa"><FontAwesomeIcon icon={faDiscord} />{t.g.discord}</ListItemButton>
                    <ListItemButton divider={true} href="https://twitter.com/PikminChallenge"><FontAwesomeIcon  icon={faTwitter}/> Twitter</ListItemButton>
                    <ListItemButton divider={true} onClick={()=> setTheme(theme === "dark" ? 'light' : 'dark')}><FontAwesomeIcon icon={theme === "dark" ? faCloudSun : faCloudMoon}/> {t.g.theme}</ListItemButton>
                    <ListItemButton divider={true} href={router.asPath} locale={r}><FontAwesomeIcon icon={faGlobe} /> {t.g.language}</ListItemButton>
                </List>
            </MobileMenuBox>
        </SwipeableDrawer>
        </>
    )
}