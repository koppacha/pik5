import Button from "@mui/material/Button";
import React, {useContext, useState} from "react";
import RecordForm from "./RecordForm";
import {Box, Grid} from "@mui/material";
import Link from "next/link";
import {RecordPostButton} from "../../styles/pik5.css";
import {FontAwesomeIcon} from "@fortawesome/react-fontawesome";
import {faPaperPlane} from "@fortawesome/free-solid-svg-icons";
import {useLocale} from "../../lib/pik5";

export default function RecordPost({info, rule, console}){

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
            <Grid item>
                <RecordPostButton
                    className="active"
                    series={info.series}
                    component={Link}
                    href="#"
                    onClick={handleClickOpen}>
                    <FontAwesomeIcon icon={faPaperPlane} /> {t.post.title}
                </RecordPostButton>
            </Grid>
            <RecordForm
                info={info}
                rule={rule}
                currentConsole={console}
                open={open}
                setOpen={setOpen}
                handleClose={handleClose}
            />
        </>
    )
}