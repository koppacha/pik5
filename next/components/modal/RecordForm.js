import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import Button from "@mui/material/Button";
import React, {useRef, useState} from "react";
import DialogContent from "@mui/material/DialogContent";
import {useForm} from "react-hook-form";
import {yupResolver} from "@hookform/resolvers/yup";
import * as yup from "yup";
import TextField from "@mui/material/TextField";
import DialogTitle from "@mui/material/DialogTitle";
import {fetcher, useLocale} from "../../lib/pik5";
import {MenuItem, Typography} from "@mui/material";
import {useSession} from "next-auth/react";
import GetRank from "./GetRank"

export default function RecordForm({info, rule, currentConsole, open, setOpen, handleClose}){

    const {t} = useLocale()
    const {data:session} = useSession()

    const now = new Date().toLocaleString()

    const [score, setScore] = useState(0)
    const [region, setRegion] = useState(0)
    const [consoles, setConsole] = useState(0)
    const [videoUrl, setVideoUrl] = useState("")
    const [comment, setComment] = useState("")
    const [img, setImg] = useState()

    // バリデーションルール
    const schema = yup.object({
        score: yup
            .number()
            .min(1, '０点以下は登録できません。')
            .max(999999, 'スコアの最大値は999,999です')
            .required(t.yup.required),
        videoUrl: yup
            .string()
            // .matches("/^https?://(www\.)?(nicovideo\.jp|youtube\.com|youtu\.be|twitch\.tv|twitter\.com)/[\w/\?=]*$/",
            //     {message:'有効なURLではありません。有効な動画サイトは「YouTube」「ニコニコ動画」「Twitch」「Twitter」です。'})
            .max(128, 'キーワードの最大文字数は128文字です。'),
        comment: yup
            .string(),
        rule: yup
            .number(),
        console: yup
            .number(),
    })

    const {register,
        handleSubmit,
        reset,
        formState: { errors}} = useForm({
        resolver: yupResolver(schema),
    })

    // const formData = new FormData()

    // キーワードをバックエンドに送信する
    const onSubmit = async () => {

        // // 送信するデータをオブジェクトに追加
        // formData.append('stage_id', info.stage_id)
        // formData.append('rule', rule)
        // formData.append('region', region)
        // formData.append('score', score)
        // formData.append('user_id', "guest")
        // formData.append('console', consoles)
        // formData.append('img', img)
        // formData.append('video_url', videoUrl)
        // formData.append('post_comment', comment)
        // formData.append('created_at', now)
        //
        // console.log("POSTing", formData)

        // const res = await fetch('http://localhost:8000/api/record', {
        //     method: 'POST',
        //     body: formData,
        // })
        // console.log(await res.json())

        const res = await fetch('/api/server/record', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                'stage_id': info.stage_id,
                'rule': rule,
                'region': region,
                'score': score,
                'user_id': "guest",
                'console': consoles,
                'img': img,
                'video_url': videoUrl,
                'post_comment': comment,
                'created_at': now
            })
        })

        console.log("Res", res)

        if(res.status < 300){
            setOpen(false)
        }
    }

    return (
        <>
            <Dialog open={open} onClose={handleClose}>
                <DialogTitle>{t.post.title}</DialogTitle>
                <DialogContent>
                    <TextField
                        id="stage"
                        label="ステージ"
                        type="text"
                        fullWidth
                        disabled
                        variant="standard"
                        defaultValue={t.stage[info.stage_id]}
                        margin="normal"
                    />
                    <TextField
                        id="rule"
                        label="ルール"
                        type="text"
                        fullWidth
                        disabled
                        variant="standard"
                        defaultValue={t.rule[rule]}
                        margin="normal"
                    />
                    <TextField
                        id="userId"
                        label="プレイヤー名"
                        type="text"
                        fullWidth
                        disabled
                        variant="standard"
                        defaultValue={session?.user.name}
                        margin="normal"
                    />
                    <TextField
                        {...register('score')}
                        id="score"
                        label="スコア"
                        type="number"
                        onChange={(e) => setScore(e.target.value)}
                        fullWidth
                        variant="standard"
                        error={'score' in errors}
                        helperText={errors.score?.message}
                        defaultValue={0}
                        margin="normal"
                    />
                    <GetRank stage={info.stage_id} rule={rule} score={score}/>
                    <TextField
                        {...register('console')}
                        select
                        id="console"
                        label="操作方法"
                        onChange={(e) => setConsole(e.target.value)}
                        fullWidth
                        variant="standard"
                        defaultValue={currentConsole}
                        margin="normal"
                    >
                        {
                            Object.keys(t.console).map((key) =>
                                <MenuItem key={key} value={key}>{t.console[key]}</MenuItem>
                            )
                        }
                    </TextField>
                    <TextField
                        {...register('img')}
                        id="img"
                        label="証拠画像"
                        type="file"
                        onChange={(e) => console.log(e)}
                        fullWidth
                        variant="standard"
                        error={'img' in errors}
                        helperText={errors.img?.message}
                        margin="normal"
                    />
                    <TextField
                        {...register('videoUrl')}
                        id="videoUrl"
                        label="証拠動画URL"
                        type="url"
                        onChange={(e) => setVideoUrl(e.target.value)}
                        fullWidth
                        variant="standard"
                        error={'videoUrl' in errors}
                        helperText={errors.videoUrl?.message}
                        defaultValue=""
                        margin="normal"
                    />
                    <TextField
                        {...register('comment')}
                        id="comment"
                        label="ひとことコメント"
                        type="text"
                        onChange={(e) => setComment(e.target.value)}
                        fullWidth
                        variant="standard"
                        error={'comment' in errors}
                        helperText={errors.comment?.message}
                        defaultValue=""
                        margin="normal"
                    />
                </DialogContent>
                <DialogActions>
                    <Button onClick={handleClose}>閉じる</Button>
                    <Button onClick={handleSubmit(onSubmit)}>送信</Button>
                </DialogActions>
            </Dialog>
        </>
    )
}