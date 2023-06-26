import Button from "@mui/material/Button";
import {Box, Typography} from "@mui/material";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import React, {useState} from "react";
import ModalKeywordEdit from "./ModalKeywordEdit";
import Link from "next/link";
import {FontAwesomeIcon} from "@fortawesome/react-fontawesome";
import {faHouseChimney, faStairs} from "@fortawesome/free-solid-svg-icons";
import {StairIcon} from "../../styles/pik5.css";

export function KeywordContent({data}){

    const [open, setOpen] = useState(false)
    const handleOpen = () => {
        setOpen(true)
    }
    const handleClose = () => {
        setOpen(false)
    }

    return (
        <>
            <Button variant="outlined">{data.tag}</Button><br/>
            #{data.unique_id}<br/>
            <Typography variant="" className="mini-title">{data.keyword}</Typography><br/>
            <Box style={{
                borderTop: "1px solid #fff",
                marginBottom: "40px",
                padding: "30px",
                lineHeight: "1.6em",
            }}>
                <ReactMarkdown
                    className="markdown-content"
                    remarkPlugins={[remarkGfm]}>
                    {data.content}
                </ReactMarkdown>
            </Box>
            <ModalKeywordEdit uniqueId={data.unique_id} open={open} handleClose={handleClose}/>
        </>
    )
}