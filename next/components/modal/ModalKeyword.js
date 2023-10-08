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
import {StyledDialogContent} from "../../styles/pik5.css";

export default function ModalKeyword({uniqueId, open, handleClose, handleEditOpen}) {

    const {t} = useLocale()

    const {data} = useSWR(`/api/server/keyword/${uniqueId}`, fetcher)

    if(!data){
        return (
            <>
            </>
        )
    }

    return (
        <>
            <Dialog open={open} onClose={handleClose} disableScrollLock>
                <StyledDialogContent>
                    <KeywordContent data={data.data}/>
                <DialogActions>
                    <Button href={"/keyword/"+uniqueId}>全画面表示</Button>
                    <Button onClick={handleClose}>{t.g.close}</Button>
                    <Button onClick={handleEditOpen}>{t.g.edit}</Button>
                </DialogActions>
                </StyledDialogContent>
            </Dialog>
        </>
    );
}
