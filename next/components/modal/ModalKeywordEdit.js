import React, {useEffect, useState} from 'react';
import Compressor from 'compressorjs'
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import {Box, Grid, MenuItem, Select} from "@mui/material";
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
            .max(32, t.yup.over + "32" + t.yup.moji)
            .matches(/^[^\s\/#?&%+<>@:]*$/u, t.yup.invalid || 'URLとして安全に使える文字のみ（/ # ? & % + < > @ : は不可）'),
        keyword: yup
            .string()
            .max(32, t.yup.over + "32" + t.yup.moji)
            .matches(/^[^\s\/#?&%+<>@:]+$/u, t.yup.invalid || 'URLとして安全に使える文字のみ（/ # ? & % + < > @ : は不可）')
            .required(t.yup.required),
        yomi: yup
            .string()
            .max(64, t.yup.over + "64" + t.yup.moji)
            .matches(/^[ぁ-んァ-ヶー々〆〤Ａ-Ｚａ-ｚ０-９]+$|^$/u, 'ひらがな・全角英数字のみ'),
        content: yup
            .string()
            .max(48000, t.yup.over + "48000" + t.yup.moji)
            .test('no-harmful-html', '不正なHTMLタグが含まれています（script/iframe/object/embed/link/style や on* 属性は禁止）', (value) => {
                if (!value) return false
                const tagRe = /<\s*(script|iframe|object|embed|link|style)[^>]*>/i
                const onAttrRe = /\son[a-z]+\s*=\s*/i
                return !tagRe.test(value) && !onAttrRe.test(value)
            })
            .required(t.yup.required)
    })

    const {data} = useSWR(`/api/server/keyword/${uniqueId}`, fetcher)

    const [tag, setTag] = useState("")
    const [keyword, setKeyword] = useState("")
    const [stageId, setStageId] = useState(0)
    const [yomi, setYomi] = useState("")
    const [content, setContent] = useState("")
    const [category, setCategory] = useState("")
    const [id, setId] = useState(String(uniqueId ?? '0'))
    const [uploads, setUploads] = useState([{ file: null, status: 'idle', error: '', imageId: '' }])

    const now = new Date().toLocaleString()
    const {register,
           handleSubmit,
           reset,
           setValue,
           formState: { errors}} = useForm({
               resolver: yupResolver(schema),
           })

    const WEB_IMAGE_EXTS = ['jpg','jpeg','png','gif','webp','avif']

    const validateExt = (name) => {
        const m = name.toLowerCase().match(/\.([a-z0-9]+)$/)
        if (!m) return false
        return WEB_IMAGE_EXTS.includes(m[1])
    }

    const handlePickFile = (idx) => async (e) => {
        const file = e.target.files?.[0]
        if (!file) return
        // reset status
        setUploads(prev => prev.map((u, i) => i === idx ? { ...u, status: 'checking', error: '', imageId: '' } : u))

        // Check 1: extension
        if (!validateExt(file.name)) {
            setUploads(prev => prev.map((u, i) => i === idx ? { ...u, status: 'error', error: '画像の拡張子が無効です（jpg, jpeg, png, gif, webp, avif）' } : u))
            return
        }

        // Check 2: size & compress to <= 5MB
        const tryUpload = async (blob) => {
            try {
                const fd = new FormData()
                // preserve original extension if possible
                const ext = (file.name.toLowerCase().match(/\.([a-z0-9]+)$/)?.[1]) || 'jpg'
                const uploadFile = new File([blob], `upload.${ext}`, { type: blob.type || file.type })
                fd.append('image', uploadFile)
                const res = await fetch('/api/server/keyword/upload', { method: 'POST', body: fd })
                if (!res.ok) throw new Error('アップロードに失敗しました')

                // Robustly parse proxy or raw backend responses
                const text = await res.text()
                let payload
                try { payload = JSON.parse(text) } catch { payload = null }
                // unwrap { data: {...} } shape if present
                const body = payload && typeof payload === 'object' ? (payload.data ?? payload) : {}
                const imageId = body?.image_id || body?.imageId || null
                if (!imageId) throw new Error('サーバー応答が不正です')

                setUploads(prev => prev.map((u, i) => i === idx ? { ...u, status: 'done', error: '', imageId } : u))
            } catch (err) {
                setUploads(prev => prev.map((u, i) => i === idx ? { ...u, status: 'error', error: String(err.message || err) } : u))
            }
        }

        if (file.size > 5 * 1024 * 1024) {
            // compress
            try {
                new Compressor(file, {
                    quality: 0.8,
                    maxWidth: 8000,
                    maxHeight: 8000,
                    success(result) {
                        if (result.size > 5 * 1024 * 1024) {
                            // fallback: reduce further if still >5MB
                            new Compressor(result, {
                                quality: 0.6,
                                success(result2) { tryUpload(result2) },
                                error(err2) { setUploads(prev => prev.map((u, i) => i === idx ? { ...u, status: 'error', error: '圧縮に失敗しました' } : u)) }
                            })
                        } else {
                            tryUpload(result)
                        }
                    },
                    error(err) {
                        setUploads(prev => prev.map((u, i) => i === idx ? { ...u, status: 'error', error: '圧縮に失敗しました' } : u))
                    }
                })
            } catch (e2) {
                setUploads(prev => prev.map((u, i) => i === idx ? { ...u, status: 'error', error: '圧縮に失敗しました' } : u))
            }
        } else {
            await tryUpload(file)
        }
    }

    const addUploader = () => setUploads(prev => [...prev, { file: null, status: 'idle', error: '', imageId: '' }])

    const copyMarkdownId = async (imageId) => {
        try {
            await navigator.clipboard.writeText(`![${imageId}]`)
        } catch {}
    }

    // キーワードをバックエンドに送信する
    const onSubmit = async (form) => {
            const uniqueIdToSend = (String(uniqueId) === '0')
              ? '0'                            // 新規作成時は常に "0"
              : (id && String(id).trim())      // 変更入力があればそれを優先
                || String(uniqueId)            // それ以外は親から継承

            const res = await fetch('/api/server/keyword', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    keyword:  (form.keyword ?? '').trim(),
                    category: form.category || 'other',
                    stage_id: Number(form.stage_id ?? 0),
                    unique_id: uniqueIdToSend,
                    tag: (form.tag ?? '').trim(),
                    yomi: (form.yomi ?? ''),
                    content: (form.content ?? ''),
                    first_editor: data?.first_editor || 'guest',
                    last_editor: session?.user?.id || 'guest',
                    created_at: now,
                    flag: 1,
                })
            })
            if(res.status < 300){
                handleEditClose()
                window.location.reload()
            }
    }

    useEffect(() => {
        reset({
            category: data?.data?.category ?? 'other',
            tag: data?.data?.tag ?? '',
            keyword: data?.data?.keyword ?? '',
            yomi: data?.data?.yomi ?? '',
            content: data?.data?.content ?? '',
        })
        setCategory(data?.data?.category)
        setTag(data?.data?.tag)
        setKeyword(data?.data?.keyword)
        setYomi(data?.data?.yomi)
        setContent(data?.data?.content)
        setStageId(data?.data?.stage_id)
        setId(String(data?.data?.unique_id ?? (uniqueId ?? '0')))
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
                            {t.g.pleaseLogin}
                        </DialogContent>
                    </Box>
                </Dialog>
            </>
        )
    }
    return (
        <>
            <Dialog
                open={editOpen}
                onClose={handleEditClose}
                fullScreen
                scroll="body"
            >
                <StyledDialogContent sx={{ height: '100vh', maxHeight: '100vh', overflowY: 'auto' }}>
                    <DialogTitle>{t.keyword.g.editTitle}</DialogTitle>
                    <Grid container spacing={2} sx={{ mt: 0 }}>
                        <Grid item xs={12} sm={6} md={4.8}>
                            <TextField
                                {...register('keyword')}
                                id="keyword"
                                label={t.keyword.g.keyword}
                                type="text"
                                fullWidth
                                variant="standard"
                                error={'keyword' in errors}
                                helperText={errors.keyword?.message}
                                value={keyword}
                                onChange={(e) => { setKeyword(e.target.value); setValue('keyword', e.target.value) }}
                            />
                        </Grid>
                        <Grid item xs={12} sm={6} md={2.4}>
                            <TextField
                                {...register('yomi')}
                                id="yomi"
                                label={t.keyword.g.yomi}
                                type="text"
                                fullWidth
                                variant="standard"
                                error={'yomi' in errors}
                                helperText={errors.yomi?.message}
                                value={yomi}
                                onChange={(e) => { setYomi(e.target.value); setValue('yomi', e.target.value) }}
                            />
                        </Grid>

                        <Grid item xs={12} sm={6} md={2.4}>
                            <TextField
                                {...register('tag')}
                                id="tag"
                                label={t.keyword.g.tag}
                                type="text"
                                fullWidth
                                variant="standard"
                                error={'tag' in errors}
                                helperText={errors.tag?.message}
                                value={tag}
                                onChange={(e) => { setTag(e.target.value); setValue('tag', e.target.value) }}
                            />
                        </Grid>

                        {(session?.user?.id === "koppacha") && (
                          <Grid item xs={12} sm={6} md={2.4}>
                            <TextField
                                {...register('unique_id')}
                                id="unique_id"
                                label="ID"
                                type="text"
                                fullWidth
                                variant="standard"
                                value={id}
                                onChange={(e) => { setId(e.target.value); setValue('unique_id', e.target.value) }}
                                inputProps={{ pattern: '^(0|[0-9a-fA-F]{13})$' }}
                            />
                          </Grid>
                        )}

                        <Grid item xs={12} sm={6} md={2.4} hidden>
                          <TextField
                            {...register('category')}
                            select
                            id="category"
                            label={t.keyword.g.category}
                            onChange={(e) => { setCategory(e.target.value); setValue('category', e.target.value) }}
                            fullWidth
                            variant="standard"
                            defaultValue={(data?.data?.category) || "other"}
                          >
                            {Object.keys(t.keyword.category).map((key) => (
                              <MenuItem key={key} value={key}>{t.keyword.category[key]}</MenuItem>
                            ))}
                          </TextField>
                        </Grid>

                        {(data?.data?.category === "idea" || category === "idea") && (
                          <Grid item xs={12} sm={6} md={2.4}>
                            <Select
                              {...register('stage_id')}
                              id="stage_id"
                              label={t.keyword.g.stageName}
                              onChange={(e) => { setStageId(e.target.value); setValue('stage_id', e.target.value) }}
                              fullWidth
                              variant="standard"
                              defaultValue={(data?.data?.stage_id) || 101}
                            >
                              {Object.keys(stages).map((stage) => (
                                <MenuItem key={stage} value={stage}>{"#"+stage+" "+t.stage[stage]}</MenuItem>
                              ))}
                            </Select>
                          </Grid>
                        )}
                    </Grid>
                    <TextField
                        {...register('content')}
                        id="content"
                        label={t.keyword.g.content}
                        type="text"
                        fullWidth
                        multiline
                        rows={25}
                        variant="standard"
                        error={'content' in errors}
                        helperText={errors.content?.message}
                        value={content}
                        onChange={(e) => { setContent(e.target.value); setValue('content', e.target.value) }}
                    />
                    {/* 画像添付（複数コンポーネント複製可） */}
                    <Box sx={{ mt: 2 }}>
                        {uploads.map((u, idx) => (
                            <Box key={idx} sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                                <Button variant="outlined" component="label">
                                    画像を選択
                                    <input hidden accept="image/*" type="file" onChange={handlePickFile(idx)} />
                                </Button>
                                {u.status === 'checking' && <span>チェック中…</span>}
                                {u.status === 'error' && <span style={{ color: 'crimson' }}>{u.error}</span>}
                                {u.imageId && (
                                    <Button type="button" variant="text" onClick={() => copyMarkdownId(u.imageId)}>
                                        {`ID: ${u.imageId}（クリックでコピー）`}
                                    </Button>
                                )}
                            </Box>
                        ))}
                    </Box>
                <DialogActions>
                    <Button type="button" variant="contained" onClick={addUploader}>画像アップローダーを追加</Button>
                    <Button type="button" variant="contained" onClick={handleEditClose}>{t.g.close}</Button>
                    <Button type="button" variant="contained" onClick={handleSubmit(onSubmit)}>{t.g.submit}</Button>
                </DialogActions>
                </StyledDialogContent>
            </Dialog>
        </>
    );
}
