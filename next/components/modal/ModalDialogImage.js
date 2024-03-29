import React, {useEffect} from 'react';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import {Box} from "@mui/material";
import {useForm} from "react-hook-form";
import * as yup from 'yup'
import {yupResolver} from "@hookform/resolvers/yup";
import Image from "next/image";

export default function ModalDialogImage({imgOpen, imgHandleClose, url}) {

    return (
        <>
            <Dialog open={imgOpen} onClose={imgHandleClose}>
                <Box style={{width:1200,height:600,backgroundColor:'#000'}}>
                    <Image
                        src={"http://laravel:8000/api/img/"+url}
                        fill={true}
                        alt="image"
                        onClick={imgHandleClose}/>
                </Box>
            </Dialog>
        </>
    );
}
