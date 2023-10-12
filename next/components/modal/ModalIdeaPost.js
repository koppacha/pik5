import React, {useEffect, useState} from 'react';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import {Box, MenuItem} from "@mui/material";
import {useForm} from "react-hook-form";
import * as yup from 'yup'
import {yupResolver} from "@hookform/resolvers/yup";
import useSWR from "swr";
import {fetcher, sliceObject, useLocale} from "../../lib/pik5";
import NowLoading from "../NowLoading";
import {StyledDialogContent} from "../../styles/pik5.css";
import {useSession} from "next-auth/react";

export default function ModalIdeaPost({uniqueId, editOpen = false, handleEditClose}) {

    const {t} = useLocale()
    const {data: session } = useSession()

    // 縛りルールのベースステージ（＝通常ランキングすべて）
    const stages = sliceObject(t.stage, 100, 428)

    // バリデーションルール
    const schema = yup.object({
        keyword: yup
            .string()
            .max(32, t.yup.over + "32" + t.yup.moji)
            .required(t.yup.required),
        content: yup
            .string()
            .max(20480, t.yup.over + "20480" + t.yup.moji)
            .required(t.yup.required)
    })

    const {data} = useSWR(`/api/server/keyword/${uniqueId}`, fetcher)

    const [tag, setTag] = useState("")
    const [keyword, setKeyword] = useState("")
    const [yomi, setYomi] = useState("")
    const [content, setContent] = useState("")
    const [category, setCategory] = useState("")
    const [stageId, setStageId] = useState(101)

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
                    'category': 'idea',
                    'stage_id': stageId || 101,
                    'unique_id': uniqueId || 0,
                    'tag': tag,
                    'yomi': yomi,
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
                category: 'idea',
                tag: "縛りルール案",
                keyword: data?.data?.keyword,
                yomi: "",
                content: data?.data?.content,
            }
        })
        setKeyword(data?.data?.keyword)
        setContent(data?.data?.content)
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
                            投稿にはログインが必要です。
                        </DialogContent>
                    </Box>
                </Dialog>
            </>
        )
    }
    return (
        <>
            <Dialog open={editOpen} onClose={handleEditClose}>
                <StyledDialogContent>
                    <DialogTitle>{t.keyword.g.editIdea}</DialogTitle>
                    <TextField
                        {...register('stage_id')}
                        select
                        id="stage_id"
                        label={t.keyword.g.stageName}
                        onChange={(e) => setCategory(e.target.value)}
                        fullWidth
                        variant="standard"
                        defaultValue={(data?.data?.category) || 101}
                    >
                        {
                            Object.keys(stages).map((stage) =>
                                <MenuItem key={stage} value={stage}>{"#"+stage+" "+t.stage[stage]}</MenuItem>
                            )
                        }
                    </TextField>
                    <TextField
                        {...register('keyword')}
                        id="keyword"
                        label={t.keyword.g.ideaName}
                        type="text"
                        onChange={(e) => setKeyword(e.target.value)}
                        fullWidth
                        variant="standard"
                        error={'keyword' in errors}
                        helperText={"ルールの概略を入力してください。ステージ名やカッコは要りません。（例：Aボタン縛り）"}
                        defaultValue={data?.data?.keyword}
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
                        helperText={"ルールの詳細を入力してください。Markdownが使えます。採用された場合は全ユーザーに公開されます。"}
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
