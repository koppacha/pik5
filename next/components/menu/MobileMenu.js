import {Collapse, List, ListItem, ListItemButton, SwipeableDrawer} from "@mui/material";
import * as React from "react";
import {MobileMenuBox} from "../../styles/pik5.css";
import {p1, ne, eg, du, bt, ce, be, ss, db, sb, p4, sp} from "../../lib/const"
import {useLocale} from "../../lib/pik5";
import {useState} from "react";
import {ExpandLess, ExpandMore} from "@mui/icons-material";
import {faDiscord, faTwitter} from "@fortawesome/free-brands-svg-icons";
import {FontAwesomeIcon} from "@fortawesome/react-fontawesome";
import {faCloudMoon, faCloudSun, faGlobe} from "@fortawesome/free-solid-svg-icons";
import {useRouter} from "next/router";
import {useTheme} from "next-themes";

export default function MobileMenu({open, toggleHandle}){

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
    const [openP4, setOpenP4] = useState(p4.includes(flag))
    const [openSP, setOpenSP] = useState(sp.includes(runFlag))


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
    const handleClickP4 = () => setOpenP4(!openP4)
    const handleClickSP = () => setOpenSP(!openSP)

    return (
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
                        {openP1 ? <ExpandLess/> : <ExpandMore/>}
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
                        {openEG ? <ExpandLess/> : <ExpandMore/>}
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
                        {openNE ? <ExpandLess/> : <ExpandMore/>}
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
                        {openDU ? <ExpandLess/> : <ExpandMore/>}
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
                        {openBT ? <ExpandLess/> : <ExpandMore/>}
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
                        {openCE ? <ExpandLess/> : <ExpandMore/>}
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
                        {openBE ? <ExpandLess/> : <ExpandMore/>}
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
                        {openSS ? <ExpandLess/> : <ExpandMore/>}
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
                        {openDB ? <ExpandLess/> : <ExpandMore/>}
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
                        {openSB ? <ExpandLess/> : <ExpandMore/>}
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
                    <ListItemButton onClick={handleClickP4}>
                        {t.title[4]}
                        {openP4 ? <ExpandLess/> : <ExpandMore/>}
                    </ListItemButton>
                    <Collapse in={openP4} timeout="auto" unmountOnExit>
                        <List>
                            {
                                p4.map(stage =>
                                    <ListItemButton key={stage} href={"/stage/"+stage}>
                                        #{stage} {t.stage[stage]}
                                    </ListItemButton>
                                )
                            }
                        </List>
                    </Collapse>
                    <ListItemButton onClick={handleClickSP}>
                        {t.speedrun.title}
                        {openSP ? <ExpandLess/> : <ExpandMore/>}
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
                    <ListItemButton href="/">{t.g.top}</ListItemButton>
                    <ListItemButton href="/keyword">{t.g.keyword}</ListItemButton>
                    <ListItemButton href="https://discord.gg/rQEBJQa"><FontAwesomeIcon icon={faDiscord} />{t.g.discord}</ListItemButton>
                    <ListItemButton href="https://twitter.com/PikminChallenge"><FontAwesomeIcon  icon={faTwitter}/> Twitter</ListItemButton>
                    <ListItemButton onClick={()=> setTheme(theme === "dark" ? 'light' : 'dark')}><FontAwesomeIcon icon={theme === "dark" ? faCloudSun : faCloudMoon}/> {t.g.theme}</ListItemButton>
                    <ListItemButton href={router.asPath} locale={r}><FontAwesomeIcon icon={faGlobe} /> {t.g.language}</ListItemButton>
                </List>
            </MobileMenuBox>
        </SwipeableDrawer>
    )
}