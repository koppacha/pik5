import React, {useEffect, useState} from 'react';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import {Box, MenuItem, Select} from "@mui/material";
import {useForm} from "react-hook-form";
import * as yup from 'yup'
import {yupResolver} from "@hookform/resolvers/yup";
import useSWR from "swr";
import {fetcher, sliceObject, useLocale} from "../../lib/pik5";
import NowLoading from "../NowLoading";
import {StyledDialogContent} from "../../styles/pik5.css";
import {useSession} from "next-auth/react";

export default function ModalKeywordEdit({uniqueId, editOpen = false, handleEditClose}) {

    const {t} = useLocale()
    const {data: session } = useSession()

    // 縛りルールのベースステージ
    const stages = sliceObject(t.stage, 100, 428)

    // バリデーションルール
    const schema = yup.object({
        category: yup
            .string()
            .required(t.yup.required),
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
            .matches(/^[ぁ-んァ-ヶー々〆〤]+$|^$/, t.yup.hiragana),
        content: yup
            .string()
            .max(48000, t.yup.over + "48000" + t.yup.moji)
            .required(t.yup.required)
    })

    const {data} = useSWR(`/api/server/keyword/${uniqueId}`, fetcher)

    const [tag, setTag] = useState("")
    const [keyword, setKeyword] = useState("")
    const [stageId, setStageId] = useState(0)
    const [yomi, setYomi] = useState("")
    const [content, setContent] = useState("")
    const [category, setCategory] = useState("")
    const [id, setId] = useState(uniqueId)

    const now = new Date().toLocaleString()
    const {register,
           handleSubmit,
           reset,
           formState: { errors}} = useForm({
               resolver: yupResolver(schema),
           })

    // キーワードをバックエンドに送信する
    const onSubmit = async () => {
            const res = await fetch('/api/server/keyword', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    'keyword': keyword,
                    'category': category || 'other',
                    'stage_id': stageId || 0,
                    'unique_id': id || 0,
                    'tag': tag,
                    'yomi': yomi || "",
                    'content': content,
                    'first_editor':data?.first_editor || 'guest',
                    'last_editor':session.user.id,
                    'created_at': now,
                    'flag': 1,
                })
            })
            if(res.status < 300){
                handleEditClose()
            }
    }

    useEffect(() => {
        reset({
            defaultValue: {
                category: data?.data?.category,
                tag: data?.data?.tag,
                keyword: data?.data?.keyword,
                yomi: data?.data?.yomi,
                content: data?.data?.content,
            }
        })
        setCategory(data?.data?.category)
        setTag(data?.data?.tag)
        setKeyword(data?.data?.keyword)
        setYomi(data?.data?.yomi)
        setContent(data?.data?.content)
        setStageId(data?.data?.stage_id)
        setId(data?.data?.id)
        // eslint-disable-next-line react-hooks/exhaustive-deps
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
    if(!session){
        return (
            <>
                <Dialog open={editOpen} onClose={handleEditClose} disableScrollLock>
                    <Box style={{width:'600px'}}>
                        <DialogContent>
                            編集にはログインが必要です。
                        </DialogContent>
                    </Box>
                </Dialog>
            </>
        )
    }
    console.log(session)
    return (
        <>
            <Dialog open={editOpen} onClose={handleEditClose}>
                <StyledDialogContent>
                    <DialogTitle>{t.keyword.g.editTitle}</DialogTitle>
                    {(session?.user?.id === "koppacha") &&
                        <TextField
                            {...register('uniqueId')}
                            id="uniqueId"
                            label="ID"
                            type="text"
                            onChange={(e) => setId(e.target.value)}
                            fullWidth
                            variant="standard"
                            defaultValue={uniqueId}
                        />
                    }
                    <TextField
                        {...register('category')}
                        select
                        id="category"
                        label={t.keyword.g.category}
                        onChange={(e) => setCategory(e.target.value)}
                        fullWidth
                        variant="standard"
                        defaultValue={(data?.data?.category) || "other"}
                    >
                        {
                            Object.keys(t.keyword.category).map((key) =>
                                <MenuItem key={key} value={key}>{t.keyword.category[key]}</MenuItem>
                            )
                        }
                    </TextField>
                    {(data?.data?.category === "idea" || category === "idea") &&
                        <Select
                            {...register('stage_id')}
                            select
                            id="stage_id"
                            label={t.keyword.g.stageName}
                            onChange={(e) => setStageId(e.target.value)}
                            fullWidth
                            variant="standard"
                            helperText={"第19回はピクミン２、ピクミン４の通常ステージから選出予定です。"}
                            defaultValue={(data?.data?.stage_id) || 101}
                        >
                            {
                                Object.keys(stages).map((stage) =>
                                    <MenuItem key={stage} value={stage}>{"#"+stage+" "+t.stage[stage]}</MenuItem>
                                )
                            }
                        </Select>
                    }
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
                        defaultValue={data?.data?.tag}
                    />
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
                        defaultValue={data?.data?.keyword}
                    />
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
                        defaultValue={data?.data?.yomi}
                    />
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
                        defaultValue={data?.data?.content}
                    />
                <DialogActions>
                    <Button onClick={handleEditClose}>{t.g.close}</Button>
                    <Button onClick={handleSubmit(onSubmit)}>{t.g.submit}</Button>
                </DialogActions>
                </StyledDialogContent>
            </Dialog>
        </>
    );
}
