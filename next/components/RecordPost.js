import Button from "@mui/material/Button";
import React, {useContext, useState} from "react";
import RecordForm from "./RecordForm";
import {Box, Grid} from "@mui/material";
import Link from "next/link";

export default function RecordPost(props){

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
                <Box
                    className={"pikmin"+props.info.series}
                    sx={{
                        border: "1px solid #fff",
                        borderRadius: "4px",
                        padding: "12px",
                        margin: "6px",
                        backgroundColor: "#fff",
                        color: "#000",
                    }}
                    component={Link}
                    href="#"
                    onClick={handleClickOpen}>
                    記録を投稿する
                </Box>
            </Grid>
            <RecordForm
                open={open}
                setOpen={setOpen}
                handleClose={handleClose}
            />
        </>
    )
}