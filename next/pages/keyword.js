import {Box, Typography} from "@mui/material";
import FormDialog from "../components/FromDialog";
import KeywordPost from "../components/KeywordPost";
import Button from "@mui/material/Button";
import React, {useEffect, useRef, useState} from "react";
import useSWR from "swr";

function fetcher(url){
    return fetch(url).then((r)=>r.json())
}

export default function Keyword(){

    const {data} = useSWR(`http://localhost:8000/api/keyword`, fetcher, { refreshInterval: 2000 })

    // 送信ボタン押下時にデータをポストする
    const [tag, setTag] = useState("")
    const [keyword, setKeyword] = useState("")
    const [yomi, setYomi] = useState("")
    const [content, setContent] = useState("")
    const [uniqueId, setUniqueId] = useState("")

    // 編集ボタン押下時にデータをリクエストして渡す
    const [editTag, setEditTag] = useState("")
    const [editKeyword, setEditKeyword] = useState("")
    const [editYomi, setEditYomi] = useState("")
    const [editContent, setEditContent] = useState("")
    const [editUniqueId, setEditUniqueId] = useState("")

    const [open, setOpen] = useState(false)

    // 新規キーワードを作成する
    const handleClickOpen = () => {
        setEditKeyword("")
        setEditYomi("")
        setEditContent("")
        setKeyword("")
        setYomi("")
        setContent("")
        setUniqueId("")
        setOpen(true)
    }
    const handleClose = () => {
        setOpen(false)
    }

    // 既存のキーワードを編集する
    const handleEdit = async (btn) => {
        const res = await fetch(`http://localhost:8000/api/keyword/${btn.target.value}`)
        const data = await res.json()
        setTag(data.tag)
        setKeyword(data.keyword)
        setYomi(data.yomi)
        setContent(data.content)
        setUniqueId(data.unique_id)
        setEditTag(data.tag)
        setEditKeyword(data.keyword)
        setEditYomi(data.yomi)
        setEditContent(data.content)
        setEditUniqueId(data.unique_id)
        setOpen(true)
    }

    return (
        <>
            <Typography variant="h5" sx={{
                fontFamily: ['"M PLUS 1 CODE"'].join(","),
            }}>ピクミンキーワード</Typography>
            <Box sx={{
                border:'1px solid #fff',
                padding: '2em',
                margin: '2em',
                borderRadius: '8px',
            }}>
            ピクミンシリーズ、ピクチャレ大会、ピクミン界隈にまつわる専門用語や流行語などをなんでも保存しておくためのページです。どなたでも編集できます。
                <Box sx={{ margin: '1em'}}>
                    <ul>
                        <li>登録できるのはピクミン界隈にある程度受け入れられている言葉に限ります。個人的に作成した造語等は削除対象です。</li>
                        <li>キーワード名及び本文は簡潔でわかりやすい表現を心がけてください。</li>
                        <li>キーワード名単独でどのシリーズやステージの用語か分かりにくい場合は（）でステージ名等を付け加えてください。その際、よみがなにカッコ及びカッコ内を含める必要はありません。</li>
                        <li>本文中のゲームタイトルは『』で囲んでください。強調したい言葉は「」で囲んでください。（キーワード名に含まれれる場合は不要）</li>
                        <li>本文にプレイヤー名を記述する場合は末尾に「氏」をつけてください。（キーワード名にプレイヤー名が含まれる場合は敬称略としてください）</li>
                    </ul>
                </Box>
            </Box>
            <Button variant="outlined" onClick={handleClickOpen}>
                キーワードを新規作成
            </Button>
            <FormDialog
                handleClose={handleClose}
                handleClickOpen={handleClickOpen}
                editTag={editTag}
                editKeyword={editKeyword}
                editYomi={editYomi}
                editContent={editContent}
                tag={tag}
                keyword={keyword}
                yomi={yomi}
                content={content}
                uniqueId={uniqueId}
                setTag={setTag}
                setKeyword={setKeyword}
                setYomi={setYomi}
                setContent={setContent}
                setUniqueId={setUniqueId}
                open={open}
                setOpen={setOpen}></FormDialog>
            {
                data?.map(post =>
                    <KeywordPost data={post} handleEdit={() => handleEdit}/>
                )
            }
        </>
    )
}