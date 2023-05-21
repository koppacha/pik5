import Button from "@mui/material/Button";
import React, {useState} from "react";
import RecordForm from "./RecordForm";
import {Box} from "@mui/material";

export default function RecordPost(){

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
                sx={{
                    border: "1px solid #fff",
                    borderRadius: "4px",
                    padding: "12px",
                    margin: "6px",
                    backgroundColor: "#fff",
                    color: "#000",
                }}
                onClick={handleClickOpen}>
                記録を投稿する
            </Box>
            <RecordForm
                open={open}
                setOpen={setOpen}
                handleClose={handleClose}
            />
        </>
    )
}