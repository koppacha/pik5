import Record from "../../components/Record";
import useSWR from "swr";
import NowLoading from "../../components/NowLoading";
import {fetcher, useLocale} from "../../plugin/pik5";
import BreadCrumb from "../../components/BreadCrumb";
import * as React from "react";
import {Box, FormControl, FormHelperText, Grid, MenuItem, Typography} from "@mui/material";
import {RuleBox, StairIcon, StyledSelect} from "../../styles/pik5.css";
import Link from "next/link";
import SpeedRunWrapper from "../../components/SpeedRunWrapper";
import SpeedRunRules from "../../components/SpeedRunRules";
import SpeedRunConsole from "../../components/SpeedRunConsole";
import {FontAwesomeIcon} from "@fortawesome/react-fontawesome";
import {faHouseChimney, faStairs} from "@fortawesome/free-solid-svg-icons";

export default function SpeedRun(){

    const {t} = useLocale()

    const stages = [101, 102, 201, 202, 203, 204, 301, 302, 303, 311, 312, 313]

    return (
        <>
            <Link href="/"><FontAwesomeIcon icon={faHouseChimney}/></Link>
            <StairIcon icon={faStairs}/>
            本編RTA<br/>
            #S000<br/>
            <Typography variant="" className="title">本編RTA</Typography><br/>
            <Typography variant="" className="subtitle">Pikmin Series Story Mode RTA</Typography><br/>
            {
                stages.map(stage =>
                    (
                        <Box component={Link} href={"/speedrun/"+stage}>
                            {t.speedrun[stage]}
                        </Box>
                    )
                )
            }
        </>
    )
}