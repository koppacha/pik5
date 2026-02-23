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
import {convertToSeconds, currentYear, rule2consoles, useLocale} from "../../lib/pik5";
import {Backdrop, Box, CircularProgress, MenuItem, ToggleButton, Typography} from "@mui/material";
import {useSession} from "next-auth/react";
import GetRank from "./GetRank"
import Link from "next/link";
import {timeStageList} from "../../lib/const";
import Compressor from "compressorjs";
import {FontAwesomeIcon} from "@fortawesome/react-fontawesome";
import {faCheck} from "@fortawesome/free-solid-svg-icons";

export default function RecordForm({info, rule, mode, open, setOpen, handleClose, initialData = null, onSuccess = null, onPosted = null}) {

    // 送信イベント判定
    const isSubmit = useRef(false)

    const consoleList = rule2consoles(rule)

    const {t} = useLocale()
    const {data: session} = useSession()

    const now = new Date().toLocaleString()

    const [score, setScore] = useState(0)
    const [time, setTime] = useState(0)
    const [region, setRegion] = useState(0)
    const [regionScore, setRegionScore] = useState(0)
    const [regionSelected, setRegionSelected] = useState(false)
    const [consoles, setConsole] = useState(0)
    const [difficulty, setDifficulty] = useState(0)
    const [videoUrl, setVideoUrl] = useState("")
    const [comment, setComment] = useState("")
    const [img, setImg] = useState(null)
    const [userAgent, setUserAgent] = useState("")
    const [isProcessing, setIsProcessing] = useState(false)

    const [pikmin, setPikmin] = useState(0)
    const [treasure, setTreasure] = useState(0)
    const [caveTime, setCaveTime] = useState("")
    const [timeValue, setTimeValue] = useState("00:00:00")

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
        time: yup
            .string()
            .matches(/^$|^(?:(?:\d{1,2}:)?\d{2}:)?\d{2}$/, '正しくない時間フォーマットが入力されています。00:00:00形式で入力してください。')
            .test('isTimeValid', '1以下のスコアは登録できません。', function (value) {
                if(!isTime()) return true
                const calculatedScore = time2score(value);
                return calculatedScore > 1;
            }),
    })

    // フォームデータの初期化
    useEffect(() => {
        const isEditMode = mode === "edit" && initialData
        const defaultConsole = Number(isEditMode ? initialData.console : consoleList[0]) || consoleList[0]
        const defaultDifficulty = Number(isEditMode ? initialData.difficulty : 0) || 0
        const defaultScore = Number(isEditMode ? initialData.score : 0) || 0
        const defaultVideoUrl = isEditMode ? (initialData.video_url || "") : ""
        const defaultComment = isEditMode ? (initialData.post_comment || "") : ""
        const defaultRegion = Number(isEditMode ? initialData.region : 0) || 0
        const defaultTime = "00:00:00"

        reset({
            time: defaultTime,
            score: defaultScore,
            console: defaultConsole,
            difficulty: defaultDifficulty,
            videoUrl: defaultVideoUrl,
            comment: defaultComment,
            "region-score": defaultScore,
        })
        setUserAgent(window.navigator.userAgent)
        setConsole(defaultConsole)
        setDifficulty(defaultDifficulty)
        setScore(defaultScore)
        setVideoUrl(defaultVideoUrl)
        setComment(defaultComment)
        setRegion(defaultRegion)
        setRegionSelected(defaultRegion > 0)
        setTimeValue(defaultTime)
    }, [mode, initialData, rule])

    const {
        register,
        setValue,
        handleSubmit,
        reset,
        formState: {errors},
        trigger
    } = useForm({
        mode: 'onChange',
        resolver: yupResolver(schema)
    })

    // データをバックエンドに送信する
    const onSubmit = async () => {

        if(isSubmit.current) return

        // ここから送信処理
        isSubmit.current = true
        setIsProcessing(true)
        try {
            const formData = new FormData()
            const isEditMode = mode === "edit" && initialData
            const payloadScore = Number(score) > 0
                ? Number(score)
                : Number(isEditMode ? initialData.score : 0)
            const payloadRule = Number(rule) > 0
                ? Number(rule)
                : Number(isEditMode ? initialData.rule : 0)
            const payloadConsole = Number(consoles) > 0
                ? Number(consoles)
                : Number(isEditMode ? initialData.console : 0)
            const payloadDifficulty = Number(difficulty) > 0
                ? Number(difficulty)
                : Number(isEditMode ? initialData.difficulty : 0)
            const payloadRegion = Number(region) > 0
                ? Number(region)
                : Number(isEditMode ? initialData.region : 0)
            const payloadVideoUrl = (videoUrl ?? "") || (isEditMode ? (initialData.video_url || "") : "")
            const payloadComment = (comment ?? "") || (isEditMode ? (initialData.post_comment || "") : "")

            // 送信するデータをオブジェクトに追加
            formData.append('stage_id', info.stage_id)
            formData.append('rule', payloadRule)
            formData.append('region', payloadRegion)
            formData.append('score', payloadScore)
            formData.append('user_id', session.user.userId)
            formData.append('console', payloadConsole)
            formData.append('difficulty', payloadDifficulty)
            if(img?.name) {
                formData.append('file', img, img.name)
            }
            formData.append('video_url', payloadVideoUrl)
            formData.append('user_agent', userAgent)
            formData.append('post_comment', payloadComment)
            formData.append('created_at', now)
            formData.append('mode', mode || "create")
            if(mode === "edit" && initialData?.unique_id){
                formData.append('edit_unique_id', initialData.unique_id)
                formData.append('old_img_url', initialData.img_url || "")
            }

            // APIへ送信
            const res = await fetch('/api/server/post', {
                method: 'POST',
                body: formData,
            })
            if (!res.ok) {
                console.error("Record post failed", res.status, await res.text().catch(() => ""))
                return
            }
            // 投稿後の処理
            setImg(null)
            setOpen(false)
            if(typeof onSuccess === "function"){
                onSuccess()
            }

            // ISR再検証はバックグラウンドで投げる（UI更新は onPosted / reload 側で担当）
            void (async () => {
                try {
                    const tokenRes = await fetch('/api/token')
                    const { token } = await tokenRes.json()
                    const getYear = currentYear()

                    const stageQuery = new URLSearchParams({
                        page: "stage",
                        id: String(info.stage_id),
                        console: String(payloadConsole),
                        rule: String(payloadRule),
                        year: String(getYear),
                        difficulty: String(payloadDifficulty || 0)
                    })

                    const revalidateReq = (url) => fetch(url, {
                        method: 'POST',
                        headers: {
                            'Authorization': `Bearer ${token}`,
                        },
                    })

                    const [resStage, resTotal, resUser] = await Promise.allSettled([
                        revalidateReq(`/api/revalidate?${stageQuery.toString()}`),
                        revalidateReq(`/api/revalidate?page=total&id=${payloadRule}`),
                        revalidateReq(`/api/revalidate?page=user&id=${session.user.userId}`),
                    ])

                    if (resStage.status === 'rejected' || resTotal.status === 'rejected' || resUser.status === 'rejected') {
                        console.error("Page Cache Clear Failed", {resStage, resTotal, resUser})
                    }
                } catch (e) {
                    console.error("Background revalidate failed", e)
                }
            })()

            if(typeof onPosted === "function"){
                await onPosted({
                    stageId: info.stage_id,
                    rule: payloadRule,
                    console: payloadConsole,
                    difficulty: payloadDifficulty
                })
                return
            }

            window.location.reload()
        } finally {
            setIsProcessing(false)
            // ここまで送信処理
            isSubmit.current = false
        }
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

    // タイム表示判定（RecordController.phpと共通）
    const isTime = () => {
        return [11, 29, 33, 35, 43, 46, 47, 91].includes(Number(rule)) || [338, 341, 343, 345, 346, 347, 348, 349, 350].includes(info?.stage_id)
    }

    // 難易度追加判定
    const isPik4 = () => {
        return [41, 42, 43, 44, 45, 46, 47].includes(Number(rule))
    }

    // リージョン違い判定
    const isRegion = () => {
        return (Number(consoles) === 4 && [203, 213, 228].includes(info?.stage_id)) || regionSelected
    }

    // タイムからスコアに変換
    function time2score(time) {
        const sec = convertToSeconds(time)
        const lestTime = timeStageList.find(({stage: s}) => s === info.stage_id)
        if (lestTime) {
            // 経過時間が表示されるタイプ（ピクミン３）→残り時間に変換して登録
            return (lestTime.time - sec) + lestTime.score
        } else {
            // 残った時間が表示されるタイプ（ピクミン４）→そのまま登録
            return sec
        }
    }
    // 本編地下のスコアを計算
    function caveCalc() {
        const sec = convertToSeconds(caveTime || "0:00:00")
        const lestTime = timeStageList.find(({stage: s}) => s === info.stage_id)
        setScore((Number(pikmin) + Number(treasure)) * 10 + Math.floor((lestTime.time - sec) / 2))
    }

    // リージョン違いのスコアを計算
    function regionCalc(){
        // 日本版を基準とするステージ別の差異を定義
        const regionList = [{stage: 203, diff: 200}, {stage: 213, diff: -100}, {stage: 228, diff: -40}]
        const diffScore = regionList.find(({stage: s}) => s === info.stage_id)
        if(diffScore !== undefined){
            const regiScore = Number(regionScore) + Number(diffScore.diff)
            setValue('score', regiScore)
            setScore(regiScore)
        } else {
            setValue('score', regionScore)
            setScore(regionScore)
        }
    }

    if (!session) {
        return (
            <>
                <Dialog open={open} onClose={handleClose}>
                    <Box style={{width: '600px'}}>
                        <DialogContent>
                            <Link href="/auth/login">{t.g.pleaseLogin}</Link>
                        </DialogContent>
                    </Box>
                </Dialog>
            </>
        )
    }

    const handleDialogRequestClose = (...args) => {
        if (isProcessing) return
        handleClose(...args)
    }

    return (
        <>
            <Backdrop
                open={isProcessing}
                sx={{color: '#fff', zIndex: (theme) => theme.zIndex.modal + 1}}
            >
                <Box style={{textAlign: "center"}}>
                    <CircularProgress color="inherit" />
                    <Typography style={{marginTop: "12px"}}>記録処理中です。しばらくお待ちください。</Typography>
                </Box>
            </Backdrop>
            <Dialog open={open} onClose={handleDialogRequestClose} disableEscapeKeyDown={isProcessing}>
                <DialogTitle>{mode === "edit" ? `${t.post.title}（再編集）` : t.post.title}</DialogTitle>
                <DialogContent>
                    <TextField
                        id="stage"
                        label={t.g.stageName}
                        type="text"
                        fullWidth
                        disabled={!!info}
                        variant="standard"
                        defaultValue={t.stage[info?.stage_id || 101]}
                        margin="normal"
                    />
                    <TextField
                        id="rule"
                        label={t.g.category}
                        type="text"
                        fullWidth
                        disabled
                        variant="standard"
                        defaultValue={t.rule[rule]}
                        margin="normal"
                    />
                    <TextField
                        id="userId"
                        label={t.g.userName}
                        type="text"
                        fullWidth
                        disabled
                        variant="standard"
                        defaultValue={session.user.name ?? ""}
                        margin="normal"
                    />
                    <TextField
                        {...register('console')}
                        select
                        id="console"
                        label={t.g.console}
                        onChange={(e) => setConsole(e.target.value)}
                        fullWidth
                        variant="standard"
                        value={consoles || consoleList[0]}
                        margin="normal"
                    >
                        {
                            consoleList.map((key) =>
                                <MenuItem key={key} value={key}>{t.console[key]}</MenuItem>
                            )
                        }
                    </TextField>
                    <TextField
                        {...register('difficulty')}
                        select
                        id="console"
                        label={t.g.difficulty}
                        onChange={(e) => setDifficulty(e.target.value)}
                        fullWidth
                        variant="standard"
                        value={difficulty || ""}
                        margin="normal"
                        className={isPik4() || "hidden"}
                    >
                        {
                            [1, 2, 3].map((key) =>
                                <MenuItem key={key} value={key}>{t.difficulty[key]}</MenuItem>
                            )
                        }
                    </TextField>
                    <ToggleButton
                        value="check"
                        selected={regionSelected}
                        color="success"
                        className={[203, 213, 228].includes(info?.stage_id) || "hidden"}
                        onChange={() => {
                            const nextSelected = !regionSelected
                            setRegionSelected(nextSelected)
                            setRegion(nextSelected ? 1 : 0)
                        }}
                    >
                        <FontAwesomeIcon icon={faCheck} />　For Nintendo Switch or non-Japanese（スイッチ版または海外版の場合はチェック）
                    </ToggleButton>
                    <TextField
                        {...register('region-score')}
                        id="region-score"
                        label={t.g.originalScore}
                        type="text"
                        inputProps={{inputMode: 'numeric'}}
                        onChange={function (e){
                            setRegionScore(e.target.value)
                        }}
                        onBlur={function(){
                            regionCalc()
                        }}
                        fullWidth
                        variant="standard"
                        error={'region-score' in errors}
                        helperText={errors.time?.message}
                        defaultValue="0"
                        margin="normal"
                        className={isRegion() || "hidden"}
                    />
                    <TextField
                        {...register('pikmin')}
                        id="pikmin"
                        label={t.g.NumOfPikmin}
                        type="text"
                        inputProps={{inputMode: 'numeric'}}
                        onChange={function (e){
                            setPikmin(e.target.value)
                        }}
                        onBlur={function(){
                            caveCalc()
                        }}
                        fullWidth
                        variant="standard"
                        error={'pikmin' in errors}
                        helperText={errors.time?.message}
                        defaultValue="0"
                        margin="normal"
                        className={[25].includes(rule) || "hidden"}
                    />
                    <TextField
                        {...register('treasure')}
                        id="treasure"
                        label={t.g.value}
                        type="text"
                        inputProps={{inputMode: 'numeric'}}
                        onChange={function (e){
                            setTreasure(e.target.value)
                        }}
                        onBlur={function(){
                            caveCalc()
                        }}
                        fullWidth
                        variant="standard"
                        error={'treasure' in errors}
                        helperText={errors.time?.message}
                        defaultValue="0"
                        margin="normal"
                        className={[25].includes(rule) || "hidden"}
                    />
                    <TextField
                        {...register('caveTime')}
                        id="caveTime"
                        label={t.g.realTime}
                        type="text"
                        inputProps={{inputMode: 'numeric'}}
                        onChange={function (e){
                            setCaveTime(e.target.value)
                        }}
                        onBlur={function(){
                            caveCalc()
                        }}
                        fullWidth
                        variant="standard"
                        error={'caveTime' in errors}
                        helperText={errors.time?.message}
                        defaultValue="00:00:00"
                        margin="normal"
                        className={[25].includes(rule) || "hidden"}
                    />
                    <TextField
                        {...register('time')}
                        id="time"
                        label={t.g.time}
                        type="text"
                        inputProps={{inputMode: 'numeric'}}
                        onChange={function (e){
                                setScore(time2score(e.target.value))
                                setTime(e.target.value)
                                setTimeValue(e.target.value)
                            }
                        }
                        fullWidth
                        variant="standard"
                        error={'time' in errors}
                        helperText={errors.time?.message}
                        value={timeValue}
                        margin="normal"
                        className={isTime() || "hidden"}
                    />
                    <TextField
                        {...register('score')}
                        id="score"
                        label={t.g.score}
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
                        disabled={(isTime() || [25].includes(rule) || isRegion()) && true}
                    />
                    <GetRank stage={info?.stage_id} rule={rule} score={score}/>
                    <TextField
                        {...register('img')}
                        id="img"
                        label={t.g.evidenceImage}
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
                        label={t.g.evidenceVideoUrl}
                        type="url"
                        onChange={(e) => setVideoUrl(e.target.value)}
                        fullWidth
                        variant="standard"
                        error={'videoUrl' in errors}
                        helperText={errors.videoUrl?.message}
                        value={videoUrl}
                        margin="normal"
                    />
                    <TextField
                        {...register('comment')}
                        id="comment"
                        label={t.g.comment}
                        type="text"
                        onChange={(e) => setComment(e.target.value)}
                        fullWidth
                        variant="standard"
                        error={'comment' in errors}
                        helperText={errors.comment?.message}
                        value={comment}
                        margin="normal"
                    />
                </DialogContent>
                <DialogActions>
                    <Button disabled={isProcessing} onClick={handleClose}>閉じる</Button>
                    <Button disabled={isProcessing || isSubmit.current} onClick={handleSubmit(onSubmit)}>送信</Button>
                </DialogActions>
            </Dialog>
        </>
    )
}
