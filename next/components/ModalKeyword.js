import React, {useState} from 'react';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import {Box} from "@mui/material";
import useSWR, {mutate} from "swr";
import {fetcher} from "../lib/pik5";
import NowLoading from "./NowLoading";
import {KeywordContent} from "./KeywordContent";

export default function ModalKeyword({uniqueId, open, handleClose, handleEditOpen}) {

    const {data} = useSWR(`http://localhost:8000/api/keyword/${uniqueId}`, fetcher)

    if(!data){
        return (
            <>
                <Dialog open={open} onClose={handleClose}>
                    <Box style={{width:'600px'}}>
                        <DialogTitle>キーワード</DialogTitle>
                        <DialogContent>
                            <NowLoading/>
                        </DialogContent>
                    </Box>
                </Dialog>
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
                        <Button onClick={handleClose}>閉じる</Button>
                        <Button onClick={handleEditOpen}>編集</Button>
                    </DialogActions>
                </Box>
            </Dialog>
        </>
    );
}
