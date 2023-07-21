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
import {useLocale} from "../../lib/pik5";
import {MenuItem} from "@mui/material";
import {useSession} from "next-auth/react";
import GetRank from "./GetRank"
import FormData from "form-data"
import Link from "next/link";

export default function RecordForm({info, rule, currentConsole, open, setOpen, handleClose}) {

    const consoleList = []

    if (info.series < 3) {
        consoleList.push(1, 2, 7)

    } else if (info.series === 3 && rule !== 36){
        consoleList.push(2, 3, 4, 5)

    } else if (rule === 35) {
        consoleList.push(2, 3, 4, 5, 6)

    } else if (info.series === 4){
        consoleList.push(3, 4)
    }

    const {t} = useLocale()
    const {data:session} = useSession()

    const now = new Date().toLocaleString()

    const [score, setScore] = useState(0)
    const [region, setRegion] = useState(0)
    const [consoles, setConsole] = useState(0)
    const [videoUrl, setVideoUrl] = useState("")
    const [comment, setComment] = useState("")
    const [img, setImg] = useState()

    const videoRegex = videoUrl ?
        // 証拠動画URLが入力された場合の正規表現
        "/^https?://(www\\.)?(nicovideo\\.jp|youtube\\.com|youtu\\.be|twitch\\.tv|twitter\\.com)/[\\w/\\?=]*$/"
        :
        // 空欄の場合はスルー
        ""

    // バリデーションルール
    const schema = yup.object({
        score: yup
            .number()
            .min(1, '０点以下は登録できません。')
            .max(99999, 'スコアの最大値は99,999です')
            .required(t.yup.required),
        videoUrl: yup
            .string()
            .matches(videoRegex,
            {message:'有効なURLではありません。有効な動画サイトは「YouTube」「ニコニコ動画」「Twitch」「Twitter」です。'})
            .max(128, 'URLの最大文字数は128文字です。'),
        comment: yup
            .string()
            .max(128, 'コメントの最大文字数は128文字です。'),
        rule: yup
            .number()
            .min(1, 'ルールの選択は必須です。'),
        console: yup
            .number()
            .min(1, '操作方法の選択は必須です。'),
    })

    const {register,
        handleSubmit,
        reset,
        formState: { errors}} = useForm({
        resolver: yupResolver(schema),
    })

    // フォームデータ格納先
    const formData = new FormData()

    // キーワードをバックエンドに送信する
    const onSubmit = async () => {

        // 送信するデータをオブジェクトに追加
        formData.append('stage_id', info.stage_id)
        formData.append('rule', rule)
        formData.append('region', region)
        formData.append('score', score)
        formData.append('user_id', session.user.id)
        formData.append('console', consoles)
        formData.append('video_url', videoUrl)
        formData.append('post_comment', comment)
        formData.append('created_at', now)

        const res = await fetch('http://localhost:8000/api/record', {
            method: 'POST',
            body: formData,
        })

        if(res.status < 300){
            setOpen(false)
        }
    }
    // 画像をアップロード
    const handleFileClick = async (e) => {
        const file = e.target.files[0]
        formData.append('file', file)
    }
    if(!session){
        return (
            <>
                <Dialog open={open} onClose={handleClose}>
                    <Link href="/auth/login">投稿にはログインが必要です。</Link>
                </Dialog>
            </>
        )
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
                        defaultValue={session.user.name ?? ""}
                        margin="normal"
                    />
                    <TextField
                        {...register('score')}
                        id="score"
                        label="スコア"
                        type={(rule === 33 || rule === 11 || [338, 341, 343].includes(info.stage_id)) ? "time" : "number"}
                        onChange={(e) => setScore(e.target.value)}
                        fullWidth
                        variant="standard"
                        error={'score' in errors}
                        helperText={errors.score?.message}
                        defaultValue={0}
                        margin="normal"
                    />
                    現在、スコアアタック系はまだ投稿できません。対応をお待ちください。
                    <GetRank stage={info.stage_id} rule={rule} score={score}/>
                    <TextField
                        {...register('console')}
                        select
                        id="console"
                        label="操作方法"
                        onChange={(e) => setConsole(e.target.value)}
                        fullWidth
                        variant="standard"
                        defaultValue={consoleList[0]}
                        margin="normal"
                    >
                        {
                            consoleList.map((key) =>
                                <MenuItem key={key} value={key}>{t.console[key]}</MenuItem>
                            )
                        }
                    </TextField>
                    <TextField
                        {...register('img')}
                        id="img"
                        label="証拠画像"
                        type="file"
                        onChange={e => handleFileClick(e)}
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