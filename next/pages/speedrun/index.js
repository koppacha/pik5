import Record from "../../components/record/Record";
import useSWR from "swr";
import NowLoading from "../../components/NowLoading";
import {fetcher, useLocale} from "../../lib/pik5";
import BreadCrumb from "../../components/BreadCrumb";
import * as React from "react";
import {Box, FormControl, FormHelperText, Grid, MenuItem, Typography} from "@mui/material";
import {RuleBox, StairIcon, StyledSelect} from "../../styles/pik5.css";
import Link from "next/link";
import SpeedRunWrapper from "../../components/record/SpeedRunWrapper";
import SpeedRunRules from "../../components/form/SpeedRunRules";
import SpeedRunConsole from "../../components/form/SpeedRunConsole";
import {FontAwesomeIcon} from "@fortawesome/react-fontawesome";
import {faHouseChimney, faStairs} from "@fortawesome/free-solid-svg-icons";

export default function SpeedRun(){

    const {t, r} = useLocale()

    const stages = [101, 102, 201, 202, 203, 204, 301, 302, 303, 311, 312, 313]

    return (
        <>
            <Link href="/"><FontAwesomeIcon icon={faHouseChimney}/></Link>
            <StairIcon icon={faStairs}/>
            本編RTA<br/>
            #S000<br/>
            <Typography variant="" className="title">{t.speedrun.title}</Typography><br/>
            <Typography variant="" className="subtitle">{r.speedrun.title}</Typography><br/>
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