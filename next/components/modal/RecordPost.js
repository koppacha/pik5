import Button from "@mui/material/Button";
import React, {useContext, useState} from "react";
import RecordForm from "./RecordForm";
import {Box, Grid} from "@mui/material";
import Link from "next/link";
import {RuleBox} from "../../styles/pik5.css";
import {FontAwesomeIcon} from "@fortawesome/react-fontawesome";
import {faPaperPlane} from "@fortawesome/free-solid-svg-icons";
import {useLocale} from "../../lib/pik5";
import {mutate} from "swr";

export default function RecordPost({info, rule, console, mode}){

    const {t, } = useLocale()

    const [open, setOpen] = useState(false)
    
    const handleClickOpen = () => {
        setOpen(true)
    }
    const handleClose = () => {
        setOpen(false)
    }

    return (
        <>
            <Box
                className={"rule-box active"}
                onClick={handleClickOpen}>
                <span><FontAwesomeIcon icon={faPaperPlane} /> {t.g.post}</span>
            </Box>
            <RecordForm
                info={info}
                rule={rule}
                open={open}
                mode={mode}
                setOpen={setOpen}
                handleClose={handleClose}
            />
        </>
    )
}