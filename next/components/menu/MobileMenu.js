import {Box, Collapse, IconButton, List, ListItem, ListItemButton, SwipeableDrawer} from "@mui/material";
import * as React from "react";
import {MobileMenuBox} from "../../styles/pik5.css";
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
                    <ListItemButton onClick={handleClickP1}>
                        {t.title[1]}
                        {openP1 ? <FontAwesomeIcon icon={faAngleUp}/> : <FontAwesomeIcon icon={faAngleDown}/>}
                    </ListItemButton>
                    <Collapse in={openP1} timeout="auto" unmountOnExit>
                        <List>
                            {
                                p1.map(stage =>
                                <ListItemButton key={stage} href={"/stage/"+stage}>
                                    #{stage} {t.stage[stage]}
                                </ListItemButton>
                                )
                            }
                        </List>
                    </Collapse>
                    <ListItemButton onClick={handleClickEG}>
                        {t.title[2]} {t.subtitle[21]}
                        {openEG ? <FontAwesomeIcon icon={faAngleUp}/> : <FontAwesomeIcon icon={faAngleDown}/>}
                    </ListItemButton>
                    <Collapse in={openEG} timeout="auto" unmountOnExit>
                        <List>
                            {
                                eg.map(stage =>
                                    <ListItemButton key={stage} href={"/stage/"+stage}>
                                        #{stage} {t.stage[stage]}
                                    </ListItemButton>
                                )
                            }
                        </List>
                    </Collapse>
                    <ListItemButton onClick={handleClickNE}>
                        {t.title[2]} {t.subtitle[22]}
                        {openNE ? <FontAwesomeIcon icon={faAngleUp}/> : <FontAwesomeIcon icon={faAngleDown}/>}
                    </ListItemButton>
                    <Collapse in={openNE} timeout="auto" unmountOnExit>
                        <List>
                            {
                                ne.map(stage =>
                                    <ListItemButton key={stage} href={"/stage/"+stage}>
                                        #{stage} {t.stage[stage]}
                                    </ListItemButton>
                                )
                            }
                        </List>
                    </Collapse>
                    <ListItemButton onClick={handleClickDU}>
                        {t.title[2]} {t.subtitle[23]}
                        {openDU ? <FontAwesomeIcon icon={faAngleUp}/> : <FontAwesomeIcon icon={faAngleDown}/>}
                    </ListItemButton>
                    <Collapse in={openDU} timeout="auto" unmountOnExit>
                        <List>
                            {
                                du.map(stage =>
                                    <ListItemButton key={stage} href={"/stage/"+stage}>
                                        #{stage} {t.stage[stage]}
                                    </ListItemButton>
                                )
                            }
                        </List>
                    </Collapse>
                    <ListItemButton onClick={handleClickBT}>
                        {t.title[2]} {t.subtitle[24]}
                        {openBT ? <FontAwesomeIcon icon={faAngleUp}/> : <FontAwesomeIcon icon={faAngleDown}/>}
                    </ListItemButton>
                    <Collapse in={openBT} timeout="auto" unmountOnExit>
                        <List>
                            {
                                bt.map(stage =>
                                    <ListItemButton key={stage} href={"/stage/"+stage}>
                                        #{stage} {t.stage[stage]}
                                    </ListItemButton>
                                )
                            }
                        </List>
                    </Collapse>
                    <ListItemButton onClick={handleClickCE}>
                        {t.title[3]} {t.subtitle[31]}
                        {openCE ? <FontAwesomeIcon icon={faAngleUp}/> : <FontAwesomeIcon icon={faAngleDown}/>}
                    </ListItemButton>
                    <Collapse in={openCE} timeout="auto" unmountOnExit>
                        <List>
                            {
                                ce.map(stage =>
                                    <ListItemButton key={stage} href={"/stage/"+stage}>
                                        #{stage} {t.stage[stage]}
                                    </ListItemButton>
                                )
                            }
                        </List>
                    </Collapse>
                    <ListItemButton onClick={handleClickBE}>
                        {t.title[3]} {t.subtitle[32]}
                        {openBE ? <FontAwesomeIcon icon={faAngleUp}/> : <FontAwesomeIcon icon={faAngleDown}/>}
                    </ListItemButton>
                    <Collapse in={openBE} timeout="auto" unmountOnExit>
                        <List>
                            {
                                be.map(stage =>
                                    <ListItemButton key={stage} href={"/stage/"+stage}>
                                        #{stage} {t.stage[stage]}
                                    </ListItemButton>
                                )
                            }
                        </List>
                    </Collapse>
                    <ListItemButton onClick={handleClickSS}>
                        {t.title[3]} {t.subtitle[34]}
                        {openSS ? <FontAwesomeIcon icon={faAngleUp}/> : <FontAwesomeIcon icon={faAngleDown}/>}
                    </ListItemButton>
                    <Collapse in={openSS} timeout="auto" unmountOnExit>
                        <List>
                            {
                                ss.map(stage =>
                                    <ListItemButton key={stage} href={"/stage/"+stage}>
                                        #{stage} {t.stage[stage]}
                                    </ListItemButton>
                                )
                            }
                        </List>
                    </Collapse>
                    <ListItemButton onClick={handleClickDB}>
                        {t.title[3]} {t.subtitle[33]}
                        {openDB ? <FontAwesomeIcon icon={faAngleUp}/> : <FontAwesomeIcon icon={faAngleDown}/>}
                    </ListItemButton>
                    <Collapse in={openDB} timeout="auto" unmountOnExit>
                        <List>
                            {
                                db.map(stage =>
                                    <ListItemButton key={stage} href={"/stage/"+stage}>
                                        #{stage} {t.stage[stage]}
                                    </ListItemButton>
                                )
                            }
                        </List>
                    </Collapse>
                    <ListItemButton onClick={handleClickSB}>
                        {t.title[3]} {t.subtitle[35]}
                        {openSB ? <FontAwesomeIcon icon={faAngleUp}/> : <FontAwesomeIcon icon={faAngleDown}/>}
                    </ListItemButton>
                    <Collapse in={openSB} timeout="auto" unmountOnExit>
                        <List>
                            {
                                sb.map(stage =>
                                    <ListItemButton key={stage} href={"/stage/"+stage}>
                                        #{stage} {t.stage[stage]}
                                    </ListItemButton>
                                )
                            }
                        </List>
                    </Collapse>
                    <ListItemButton onClick={handleClickDC}>
                        {t.title[4]} {t.subtitle[41]}
                        {openDC ? <FontAwesomeIcon icon={faAngleUp}/> : <FontAwesomeIcon icon={faAngleDown}/>}
                    </ListItemButton>
                    <Collapse in={openDC} timeout="auto" unmountOnExit>
                        <List>
                            {
                                dc.map(stage =>
                                    <ListItemButton key={stage} href={"/stage/"+stage}>
                                        #{stage} {t.stage[stage]}
                                    </ListItemButton>
                                )
                            }
                        </List>
                    </Collapse>
                    <ListItemButton onClick={handleClickDD}>
                        {t.title[4]} {t.subtitle[42]}
                        {openDD ? <FontAwesomeIcon icon={faAngleUp}/> : <FontAwesomeIcon icon={faAngleDown}/>}
                    </ListItemButton>
                    <Collapse in={openDD} timeout="auto" unmountOnExit>
                        <List>
                            {
                                dd.map(stage =>
                                    <ListItemButton key={stage} href={"/stage/"+stage}>
                                        #{stage} {t.stage[stage]}
                                    </ListItemButton>
                                )
                            }
                        </List>
                    </Collapse>
                    <ListItemButton onClick={handleClickEX}>
                        {t.title[4]} {t.subtitle[43]}
                        {openEX ? <FontAwesomeIcon icon={faAngleUp}/> : <FontAwesomeIcon icon={faAngleDown}/>}
                    </ListItemButton>
                    <Collapse in={openEX} timeout="auto" unmountOnExit>
                        <List>
                            {
                                ex.map(stage =>
                                    <ListItemButton key={stage} href={"/stage/"+stage}>
                                        #{stage} {t.stage[stage]}
                                    </ListItemButton>
                                )
                            }
                        </List>
                    </Collapse>
                    <ListItemButton onClick={handleClickSP}>
                        {t.speedrun.title}
                        {openSP ? <FontAwesomeIcon icon={faAngleUp}/> : <FontAwesomeIcon icon={faAngleDown}/>}
                    </ListItemButton>
                    <Collapse in={openSP} timeout="auto" unmountOnExit>
                        <List>
                            {
                                sp.map(stage =>
                                    <ListItemButton key={"s"+stage} href={"/speedrun/"+stage}>
                                        #S{stage} {t.speedrun[stage]}
                                    </ListItemButton>
                                )
                            }
                        </List>
                    </Collapse>
                    <ListItemButton onClick={handleClickOT}>
                        {t.title[9]}
                        {openOT ? <FontAwesomeIcon icon={faAngleUp}/> : <FontAwesomeIcon icon={faAngleDown}/>}
                    </ListItemButton>
                    <Collapse in={openOT} timeout="auto" unmountOnExit>
                        <List>
                            {
                                ot.map(stage =>
                                    <ListItemButton key={"s"+stage} href={"/stage/"+stage}>
                                        #{stage} {t.stage[stage]}
                                    </ListItemButton>
                                )
                            }
                        </List>
                    </Collapse>
                    <ListItemButton href="/"><span>{t.g.top}</span></ListItemButton>
                    <ListItemButton href="/keyword"><span>{t.g.keyword}</span></ListItemButton>
                    <ListItemButton href="https://discord.gg/rQEBJQa"><FontAwesomeIcon icon={faDiscord} />{t.g.discord}</ListItemButton>
                    <ListItemButton href="https://twitter.com/PikminChallenge"><FontAwesomeIcon  icon={faTwitter}/> Twitter</ListItemButton>
                    <ListItemButton onClick={()=> setTheme(theme === "dark" ? 'light' : 'dark')}><FontAwesomeIcon icon={theme === "dark" ? faCloudSun : faCloudMoon}/> {t.g.theme}</ListItemButton>
                    <ListItemButton href={router.asPath} locale={r}><FontAwesomeIcon icon={faGlobe} /> {t.g.language}</ListItemButton>
                </List>
            </MobileMenuBox>
        </SwipeableDrawer>
        </>
    )
}