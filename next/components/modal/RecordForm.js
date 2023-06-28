import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import Button from "@mui/material/Button";
import React, {useState} from "react";
import DialogContent from "@mui/material/DialogContent";
import {useForm} from "react-hook-form";
import {yupResolver} from "@hookform/resolvers/yup";
import * as yup from "yup";
import TextField from "@mui/material/TextField";
import DialogTitle from "@mui/material/DialogTitle";
import {useLocale} from "../../lib/pik5";
import {MenuItem} from "@mui/material";

export default function RecordForm(props){

    const {t} = useLocale()

    const now = new Date().toLocaleString()

    const [score, setScore] = useState(0)
    const [region, setRegion] = useState(0)
    const [console, setConsole] = useState(0)
    const [videoUrl, setVideoUrl] = useState("")
    const [comment, setComment] = useState("")

    // バリデーションルール
    const schema = yup.object({
        score: yup
            .number()
            .max(999999, 'スコアの最大値は999,999です'),
        userId: yup
            .string()
            .max(32, 'キーワードの最大文字数は32文字です。')
            .required('この項目は必須です。'),
        videoUrl: yup
            .string()
            .max(64, 'キーワードの最大文字数は32文字です。')
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
                'stage_id': 201,
                'rule': 20,
                'region': region,
                'score': score,
                'user_id': "guest",
                'console': console,
                'img_url': "",
                'video_url': videoUrl,
                'post_comment': comment,
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
                <DialogTitle>{t.post.title}</DialogTitle>
                <DialogContent>
                    <TextField
                        {...register('score')}
                        id="score"
                        label="スコア"
                        type="number"
                        onChange={(e) => setScore(e.target.value)}
                        fullWidth
                        variant="standard"
                        error={'yomi' in errors}
                        helperText={errors.score?.message}
                        defaultValue={0}
                    />
                    <TextField
                        {...register('console')}
                        select
                        id="console"
                        label="操作方法"
                        onChange={(e) => setConsole(e.target.value)}
                        fullWidth
                        variant="standard"
                        defaultValue={0}
                    >
                        {
                            Object.keys(t.console).map((key) =>
                                <MenuItem key={key} value={key}>{t.console[key]}</MenuItem>
                            )
                        }
                    </TextField>
                    <TextField
                        {...register('video_url')}
                        id="video_url"
                        label="証拠動画URL"
                        type="url"
                        onChange={(e) => setVideoUrl(e.target.value)}
                        fullWidth
                        variant="standard"
                        error={'videoUrl' in errors}
                        helperText={errors.videoUrl?.message}
                        defaultValue={0}
                    />
                </DialogContent>
                <DialogActions>
                    <Button onClick={props.handleClose}>閉じる</Button>
                    <Button onClick={handleSubmit(onSubmit)}>送信</Button>
                </DialogActions>
            </Dialog>
        </>
    )
}