import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import Button from "@mui/material/Button";
import React from "react";
import DialogContent from "@mui/material/DialogContent";
import {useForm} from "react-hook-form";
import {yupResolver} from "@hookform/resolvers/yup";
import * as yup from "yup";

export default function RecordForm(props){

    const now = new Date().toLocaleString()

    // バリデーションルール
    const schema = yup.object({
        record: yup
            .string()
            .max(32, 'タグの最大文字数は32文字です。'),
        user_name: yup
            .string()
            .max(32, 'キーワードの最大文字数は32文字です。')
            .required('この項目は必須です。')
    })

    const {register,
        handleSubmit,
        reset,
        formState: { errors}} = useForm({
        resolver: yupResolver(schema),
    })

    // キーワードをバックエンドに送信する
    const onSubmit = async () => {
        const res = await fetch('http://localhost:8000/api/record', {
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

    return (
        <>
            <Dialog open={props.open} onClose={props.handleClose}>
                <DialogContent>
                    記録を新規投稿する
                </DialogContent>
                <DialogActions>
                    <Button onClick={props.handleClose}>閉じる</Button>
                    <Button onClick={handleSubmit(onSubmit)}>送信</Button>
                </DialogActions>
            </Dialog>
        </>
    )
}