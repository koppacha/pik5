import React, {useEffect, useState} from 'react';
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
import useSWR from "swr";
import {fetcher, useLocale} from "../../lib/pik5";
import NowLoading from "../NowLoading";

export default function ModalKeywordEdit({uniqueId, editOpen, handleEditClose}) {

    const {t} = useLocale()

    // バリデーションルール
    const schema = yup.object({
        tag: yup
            .string()
            .max(32, t.yup.over + "32" + t.yup.moji),
        keyword: yup
            .string()
            .max(32, t.yup.over + "32" + t.yup.moji)
            .required(t.yup.required),
        yomi: yup
            .string()
            .max(64, t.yup.over + "64" + t.yup.moji)
            .matches(/^[ぁ-んー]+$/, t.yup.hiragana)
            .required(t.yup.required),
        content: yup
            .string()
            .max(2048, t.yup.over + "2048" + t.yup.moji)
            .required(t.yup.required)
    })

    // 送信ボタン押下時にデータをポストする
    const [tag, setTag] = useState("")
    const [keyword, setKeyword] = useState("")
    const [yomi, setYomi] = useState("")
    const [content, setContent] = useState("")

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
                    'keyword': keyword,
                    'unique_id': uniqueId || 0,
                    'tag': tag,
                    'yomi': yomi,
                    'content': content,
                    'first_editor':data.first_editor || 'guest',
                    'last_editor':'guest', // ←常にログインID
                    'created_at': now
                })
            })
            if(res.status < 300){
                handleEditClose()
            }
    }

    const {data} = useSWR(`http://localhost:8000/api/keyword/${uniqueId}`, fetcher)

    console.log(data)

    useEffect(() => {
        reset({
            defaultValue: {
                tag: data?.tag,
                keyword: data?.keyword,
                yomi: data?.yomi,
                content: data?.content,
            }
        })
    }, [data])

    if(!data){
        return (
            <>
                <Dialog open={editOpen} onClose={handleEditClose}>
                    <Box style={{width:'600px'}}>
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
            <Dialog open={editOpen} onClose={handleEditClose}>
                <Box style={{width:'600px'}}>
                <DialogTitle>{t.keyword.g.editTitle}</DialogTitle>
                <DialogContent>
                    <TextField
                        {...register('tag')}
                        id="tag"
                        label={t.keyword.g.tag}
                        type="text"
                        onChange={(e) => setTag(e.target.value)}
                        fullWidth
                        variant="standard"
                        error={'tag' in errors}
                        helperText={errors.tag?.message}
                        defaultValue={data?.tag}
                    />
                </DialogContent>
                <DialogContent>
                    <TextField
                        {...register('keyword')}
                        id="keyword"
                        label={t.keyword.g.keyword}
                        type="text"
                        onChange={(e) => setKeyword(e.target.value)}
                        fullWidth
                        variant="standard"
                        error={'keyword' in errors}
                        helperText={errors.keyword?.message}
                        defaultValue={data?.keyword}
                    />
                </DialogContent>
                <DialogContent>
                    <TextField
                        {...register('yomi')}
                        id="yomi"
                        label={t.keyword.g.yomi}
                        type="text"
                        onChange={(e) => setYomi(e.target.value)}
                        fullWidth
                        variant="standard"
                        error={'yomi' in errors}
                        helperText={errors.yomi?.message}
                        defaultValue={data?.yomi}
                    />
                </DialogContent>
                <DialogContent>
                    <TextField
                        {...register('content')}
                        id="content"
                        label={t.keyword.g.content}
                        type="text"
                        onChange={(e) => setContent(e.target.value)}
                        fullWidth
                        multiline
                        rows={5}
                        variant="standard"
                        error={'content' in errors}
                        helperText={errors.content?.message}
                        defaultValue={data?.content}
                    />
                </DialogContent>

                <DialogActions>
                    <Button onClick={handleEditClose}>{t.g.close}</Button>
                    <Button onClick={handleSubmit(onSubmit)}>{t.g.submit}</Button>
                </DialogActions>
                </Box>
            </Dialog>
        </>
    );
}