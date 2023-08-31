import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import Button from "@mui/material/Button";
import React, {useEffect, useRef, useState} from "react";
import DialogContent from "@mui/material/DialogContent";
import {useForm} from "react-hook-form";
import {yupResolver} from "@hookform/resolvers/yup";
import * as yup from "yup";
import TextField from "@mui/material/TextField";
import DialogTitle from "@mui/material/DialogTitle";
import {fetcher, useLocale} from "../../lib/pik5";
import {Box, MenuItem} from "@mui/material";
import {useSession} from "next-auth/react";
import GetRank from "./GetRank"
import FormData from "form-data"
import Link from "next/link";
import {timeStageList} from "../../lib/const";
import Compressor from "compressorjs";

export default function RecordForm({info, rule, mode, open, setOpen, handleClose}) {

    // 送信イベント判定
    const isSubmit = useRef(false)

    const consoleList = []

    if (!info) {
        // バトルモードの場合
        if(mode === "battle") {
            consoleList.push(3, 4)
        }
    } else if (info.series < 3) {
        consoleList.push(1, 2, 7)

    } else if (info.series === 3 && rule !== 36) {
        consoleList.push(2, 3, 4, 5)

    } else if (rule === 35) {
        consoleList.push(2, 3, 4, 5, 6)

    } else if (info.series === 4) {
        consoleList.push(3, 4)
    }

    const {t} = useLocale()
    const {data: session} = useSession()

    const now = new Date().toLocaleString()

    const [score, setScore] = useState(0)
    const [region, setRegion] = useState(0)
    const [consoles, setConsole] = useState(0)
    const [videoUrl, setVideoUrl] = useState("")
    const [comment, setComment] = useState("")
    const [img, setImg] = useState(null)

    const videoRegex = videoUrl ?
        // 証拠動画URLが入力された場合の正規表現
        /^https?:\/\/(www\.)?(nicovideo\.jp|youtube\.com|youtu\.be|twitch\.tv|twitter\.com)\/[\w\-\/?=]*$/
        :
        // 空欄の場合はスルー
        ""

    // バリデーションルール
    const schema = yup.object({
        score: yup
            .number()
            .min(1, '０点以下は登録できません。')
            .max(99999, 'スコアの最大値は99,999です'),
        videoUrl: yup
            .string()
            .matches(videoRegex,
                {message: '有効なURLではありません。有効な動画サイトは「YouTube」「ニコニコ動画」「Twitch」「Twitter」です。'})
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

    // フォームデータの初期化
    useEffect(() => {
        reset({
            defaultValue: {
                time: "00:00:00",
                score: 0,
                console: consoleList[0],
                videoUrl: "",
                comment: "",
            }
        })
        setConsole(consoleList[0])
    }, [])

    const {
        register,
        handleSubmit,
        reset,
        formState: {errors}
    } = useForm({
        resolver: yupResolver(schema),
    })

    // フォームデータ格納先
    const formData = new FormData()

    // キーワードをバックエンドに送信する
    const onSubmit = async () => {

        if(isSubmit.current) return

        // 送信確認（暫定的な実装）
        const confirm = window.confirm(t.g.confirm)

        // ここから送信処理
        isSubmit.current = true

        if (confirm) {
            // 送信するデータをオブジェクトに追加
            formData.append('stage_id', info.stage_id)
            formData.append('rule', rule)
            formData.append('region', region)
            formData.append('score', score)
            formData.append('user_id', session.user.id)
            formData.append('console', consoles)
            if(img?.name) {
                formData.append('file', img, img.name)
            }
            formData.append('video_url', videoUrl)
            formData.append('post_comment', comment)
            formData.append('created_at', now)

            const res = await fetch('/api/server/post', {
                method: 'POST',
                body: formData,
            })

            if (res.status < 300) {
                setImg(null)
                setOpen(false)
            }
        }
        // ここまで送信処理
        isSubmit.current = false
    }
    // 画像をアップロード
    const handleFileClick = async (e) => {
        e.preventDefault()
        const file = e.target.files[0]
        if (!file) {
            return null
        }
        // 1MBを超える画像は圧縮し、失敗した場合は添付しない
        new Compressor(file, {
            quality: 0.6,
            retainExif: true,
            convertSize: 1000000,
            success(result) {
                setImg(result)
            },
            error(err) {
                console.log(err.message)
            }
        })
    }

    // タイム表示判定
    const isTime = () => {
        return rule === 33 || rule === 11 || rule === 43 || [338, 341, 343].includes(info?.stage_id)
    }

    // タイムからスコアに変換
    function time2score(time) {
        const sec = convertToSeconds(time)
        const lestTime = timeStageList.find(({stage: s}) => s === info.stage_id)
        if (lestTime) {
            // 経過時間が表示されるタイプ（ピクミン３）→残り時間に変換して登録
            setScore((lestTime.time - sec))
        } else {
            // 残った時間が表示されるタイプ（ピクミン４）→そのまま登録
            setScore(sec)
        }
    }

    // "h:mm:ss"形式の文字列を秒数に変換する関数
    const convertToSeconds = (timeString) => {

        // Stepsが効かない端末ではhoursを強制的に補完する
        const hour = (timeString.match(/:/g) || []).length < 2 ? "00:" : ""

        const [hours, minutes, seconds] = (hour + timeString).split(':');
        return parseInt(hours) * 3600 + parseInt(minutes) * 60 + parseInt(seconds);
    }

    if (!session) {
        return (
            <>
                <Dialog open={open} onClose={handleClose}>
                    <Box style={{width: '600px'}}>
                        <DialogContent>
                            <Link href="/auth/login">投稿にはログインが必要です。</Link>
                        </DialogContent>
                    </Box>
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
                        disabled={!!info}
                        variant="standard"
                        defaultValue={t.stage[info?.stage_id || 101]}
                        margin="normal"
                    />
                    <TextField
                        id="rule"
                        label="ルール/カテゴリ"
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
                        id="time"
                        label="タイム"
                        type="time"
                        inputProps={{step: 1, inputMode: 'numeric', pattern: '[0-9]*'}}
                        onChange={(e) => time2score(e.target.value)}
                        fullWidth
                        variant="standard"
                        error={'time' in errors}
                        helperText={errors.time?.message}
                        defaultValue="00:00:00"
                        margin="normal"
                        className={isTime() || "hidden"}
                    />
                    <TextField
                        {...register('score')}
                        id="score"
                        label="スコア"
                        type="text"
                        inputProps={{inputMode: 'numeric', pattern: '[0-9]*'}}
                        onChange={(e) => setScore(e.target.value)}
                        fullWidth
                        variant="standard"
                        error={'score' in errors}
                        helperText={errors.score?.message}
                        defaultValue={0}
                        value={score}
                        margin="normal"
                        disabled={isTime() && true}
                    />
                    <GetRank stage={info?.stage_id} rule={rule} score={score}/>
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
                    <Button disabled={isSubmit.current} onClick={handleSubmit(onSubmit)}>送信</Button>
                </DialogActions>
            </Dialog>
        </>
    )
}