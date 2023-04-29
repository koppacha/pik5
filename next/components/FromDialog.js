import React, {useState} from 'react';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import {Box} from "@mui/material";
import {useRouter} from "next/router";
import {useForm} from "react-hook-form";
import * as yup from 'yup'
import {yupResolver} from "@hookform/resolvers/yup";

// バリデーションルール
const schema = yup.object({
    keyword: yup
        .string()
        .max(32, 'キーワードの最大文字数は32文字です。')
        .required('この項目は必須です。'),
    yomi: yup
        .string()
        .matches(/^[\u3040-\u309F]+$/, 'よみがなは全てひらがなで入力してください。')
        .required('この項目は必須です。'),
    content: yup
        .string()
        .required('この項目は必須です。')
})

export default function FormDialog() {

    const [open, setOpen] = useState(false)
    const [keyword, setKeyword] = useState("")
    const [yomi, setYomi] = useState("")
    const [content, setContent] = useState("")
    const router = useRouter()
    const {register,
           handleSubmit,
           formState: { errors}} = useForm({
        resolver: yupResolver(schema),
    })

    const handleClickOpen = () => {
        setOpen(true);
    };

    const handleClose = () => {
        setOpen(false);
    };

    const onSubmit = async () => {
            const res = await fetch('http://localhost:8000/api/keyword', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    'keyword': keyword,
                    'yomi': yomi,
                    'content': content
                })
            })
            if(res.status < 300){
                setOpen(false)
                router.reload()
            }
        }

    return (
        <div>
            <Button variant="outlined" onClick={handleClickOpen}>
                キーワードを新規作成
            </Button>
            <Dialog open={open} onClose={handleClose}>
                <Box sx={{width:'600px'}}>
                <DialogTitle>キーワードを新規作成する</DialogTitle>
                <DialogContent>
                    <TextField
                        autoFocus
                        id="keyword"
                        label="キーワード名"
                        type="text"
                        onChange={(e) => setKeyword(e.target.value)}
                        fullWidth
                        variant="standard"
                        {...register('keyword')}
                        error={'keyword' in errors}
                        helperText={errors.keyword?.message}
                    />
                </DialogContent>
                <DialogContent>
                    <TextField
                        id="yomi"
                        label="よみがな"
                        type="text"
                        onChange={(e) => setYomi(e.target.value)}
                        fullWidth
                        variant="standard"
                        {...register('yomi')}
                        error={'yomi' in errors}
                        helperText={errors.yomi?.message}
                    />
                </DialogContent>
                <DialogContent>
                    <TextField
                        id="content"
                        label="本文"
                        type="text"
                        onChange={(e) => setContent(e.target.value)}
                        fullWidth
                        multiline
                        rows={5}
                        variant="standard"
                        {...register('content')}
                        error={'content' in errors}
                        helperText={errors.content?.message}
                    />
                </DialogContent>

                <DialogActions>
                    <Button onClick={handleClose}>閉じる</Button>
                    <Button onClick={handleSubmit(onSubmit)}>送信</Button>
                </DialogActions>
                </Box>
            </Dialog>
        </div>
    );
}
