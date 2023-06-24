import {Box, Typography} from "@mui/material";
import Button from "@mui/material/Button";
import ReactMarkdown from "react-markdown";
import Link from "next/link";
import {FontAwesomeIcon} from "@fortawesome/react-fontawesome";
import {faHouseChimney, faStairs} from "@fortawesome/free-solid-svg-icons";
import {StairIcon} from "../styles/pik5.css";
import React, {useState} from "react";
import ModalKeywordEdit from "./ModalKeywordEdit";
import {mutate} from "swr";

export default function KeywordPost({data}) {

    const [open, setOpen] = useState(false)
    const handleOpen = () => {
        setOpen(true)
    }
    const handleClose = () => {
        setOpen(false)
        mutate()
    }

    return (
        <>
            <Link href="/"><FontAwesomeIcon icon={faHouseChimney}/></Link>
            <StairIcon icon={faStairs}/>
            <Link href="/keyword">ピクミンキーワード</Link><br/>
            <Button variant="outlined">{data.tag}</Button><br/>
            #{data.unique_id}<br/>
            <Typography variant="" className="mini-title">{data.keyword}</Typography><br/>
            <Box style={{
                borderTop:"1px solid #fff",
                marginBottom:"40px",
                padding:"8px",
                lineHeight:"1.6em"
            }}>
                <ReactMarkdown>
                {
                    data.content
                }
                </ReactMarkdown>
                <Button
                    variant="outlined"
                    onClick={handleOpen}
                >
                    編集
                </Button>
                <ModalKeywordEdit uniqueId={data.unique_id} open={open} handleClose={handleClose}/>
            </Box>
        </>
    )
}