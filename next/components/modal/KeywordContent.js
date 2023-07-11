import Button from "@mui/material/Button";
import {Box, Typography} from "@mui/material";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import React, {useEffect, useState} from "react";
import ModalKeywordEdit from "./ModalKeywordEdit";
import Link from "next/link";
import {FontAwesomeIcon} from "@fortawesome/react-fontawesome";
import {faHouseChimney, faStairs} from "@fortawesome/free-solid-svg-icons";
import {StairIcon} from "../../styles/pik5.css";
import {dateFormat} from "../../lib/pik5";

export function KeywordContent({data}){

    const [open, setOpen] = useState(false)
    const handleOpen = () => {
        setOpen(true)
    }
    const handleClose = () => {
        setOpen(false)
    }
    const date = new Date(data.updated_at)
    const [isClient, setIsClient] = useState(false)
    useEffect(() => setIsClient(true), [])

    return (
        <>
            <Typography variant="" style={{fontSize:"0.8em",color:"#777"}}>{data.yomi}</Typography><br/>
            <Typography variant="" className="mini-title">{data.keyword}</Typography><br/>
            <Box style={{
                borderTop: "1px solid #555",
                borderBottom: "1px solid #555"
            }}>
                <Button variant="outlined" style={{margin:"8px",padding:"2px"}}>{data.tag}</Button>
                <Box style={{
                    padding: "20px",
                    lineHeight: "1.6em",
                }}>
                    <ReactMarkdown
                        className="markdown-content"
                        remarkPlugins={[remarkGfm]}>
                        {data.content}
                    </ReactMarkdown>
                </Box>
            </Box>
            <Box style={{textAlign:"right"}}>
                <Typography variant="span" className="subtitle">{data.last_editor} (<time dateTime={date.toISOString()}>{isClient ? dateFormat(date) : ''}</time>)</Typography>
            </Box>
            <ModalKeywordEdit uniqueId={data.unique_id} open={open} handleClose={handleClose}/>
        </>
    )
}