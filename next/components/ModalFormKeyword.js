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

// バリデーションルール
const schema = yup.object({
    tag: yup
        .string()
        .max(32, 'タグの最大文字数は32文字です。'),
    keyword: yup
        .string()
        .max(32, 'キーワードの最大文字数は32文字です。')
        .required('この項目は必須です。'),
    yomi: yup
        .string()
        .max(64, 'よみがなの最大文字数は64文字です。')
        .matches(/^[ぁ-んー]+$/, 'よみがなは全てひらがなで入力してください。')
        .required('この項目は必須です。'),
    content: yup
        .string()
        .max(2048, '本文の最大文字数は2048文字です。')
        .required('この項目は必須です。')
})

export default function ModalFormKeyword(props) {

    const now = new Date().toLocaleString()
    const {register,
           handleSubmit,
           reset,
           formState: { errors}} = useForm({
               resolver: yupResolver(schema),
           })

    // キーワードをバックエンドに送信する
    const onSubmit = async () => {
            const res = await fetch('http://localhost:8000/api/keyword', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    'keyword': props.keyword,
                    'unique_id': props.unique_id || 0,
                    'tag': props.tag,
                    'yomi': props.yomi,
                    'content': props.content,
                    'created_at': now
                })
            })
            if(res.status < 300){
                props.setOpen(false)
            }
    }

    // フォームのリセット
    useEffect(() => {
        reset({
            defaultValue: {
                tag: props.editTag,
                keyword: props.editKeyword,
                yomi: props.editYomi,
                content: props.editContent
            }
        })
    }, [props])

    return (
        <>
            <Dialog open={props.open} onClose={props.handleClose}>
                <Box sx={{width:'600px'}}>
                <DialogTitle>キーワードを作成・編集する</DialogTitle>
                <DialogContent>
                    <TextField
                        {...register('tag')}
                        id="tag"
                        label="タグ"
                        type="text"
                        onChange={(e) => props.setTag(e.target.value)}
                        fullWidth
                        variant="standard"
                        error={'tag' in errors}
                        helperText={errors.tag?.message}
                        defaultValue={props.editTag}
                    />
                </DialogContent>
                <DialogContent>
                    <TextField
                        {...register('keyword')}
                        id="keyword"
                        label="キーワード名"
                        type="text"
                        onChange={(e) => props.setKeyword(e.target.value)}
                        fullWidth
                        variant="standard"
                        error={'keyword' in errors}
                        helperText={errors.keyword?.message}
                        defaultValue={props.editKeyword}
                    />
                </DialogContent>
                <DialogContent>
                    <TextField
                        {...register('yomi')}
                        id="yomi"
                        label="よみがな"
                        type="text"
                        onChange={(e) => props.setYomi(e.target.value)}
                        fullWidth
                        variant="standard"
                        error={'yomi' in errors}
                        helperText={errors.yomi?.message}
                        defaultValue={props.editYomi}
                    />
                </DialogContent>
                <DialogContent>
                    <TextField
                        {...register('content')}
                        id="content"
                        label="本文"
                        type="text"
                        onChange={(e) => props.setContent(e.target.value)}
                        fullWidth
                        multiline
                        rows={5}
                        variant="standard"
                        error={'content' in errors}
                        helperText={errors.content?.message}
                        defaultValue={props.editContent}
                    />
                </DialogContent>

                <DialogActions>
                    <Button onClick={props.handleClose}>閉じる</Button>
                    <Button onClick={handleSubmit(onSubmit)}>送信</Button>
                </DialogActions>
                </Box>
            </Dialog>
        </>
    );
}
