import React, {useState} from 'react';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import {Box} from "@mui/material";
import useSWR, {mutate} from "swr";
import {fetcher, useLocale} from "../../lib/pik5";
import NowLoading from "../NowLoading";
import {KeywordContent} from "./KeywordContent";

export default function ModalKeyword({uniqueId, open, handleClose, handleEditOpen}) {

    const {t} = useLocale()

    const {data} = useSWR(`http://localhost:8000/api/keyword/${uniqueId}`, fetcher)

    if(!data){
        return (
            <>
            </>
        )
    }

    return (
        <>
            <Dialog open={open} onClose={handleClose}>
                <Box style={{width:'600px'}}>
                    <DialogContent>
                        <KeywordContent data={data}/>
                    </DialogContent>
                    <DialogActions>
                        <Button href={"/keyword/"+uniqueId}>全画面表示</Button>
                        <Button onClick={handleClose}>{t.g.close}</Button>
                        <Button onClick={handleEditOpen}>{t.g.edit}</Button>
                    </DialogActions>
                </Box>
            </Dialog>
        </>
    );
}
