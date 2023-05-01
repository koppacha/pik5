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
    const [keyword, setKeyword] = useState("")
    const [yomi, setYomi] = useState("")
    const [content, setContent] = useState("")

    // 編集ボタン押下時にデータをリクエストして渡す
    const [editKeyword, setEditKeyword] = useState("")
    const [editYomi, setEditYomi] = useState("")
    const [editContent, setEditContent] = useState("")

    const [open, setOpen] = useState(false)

    const handleClickOpen = () => {
        setEditKeyword("")
        setEditYomi("")
        setEditContent("")
        setKeyword("")
        setYomi("")
        setContent("")
        setOpen(true)
    }
    const handleClose = () => {
        setOpen(false)
    }
    const handleEdit = async (btn) => {
        const res = await fetch(`http://localhost:8000/api/keyword/${btn.target.value}`)
        const data = await res.json()
        setKeyword(data.keyword)
        setYomi(data.yomi)
        setContent(data.content)
        setEditKeyword(data.keyword)
        setEditYomi(data.yomi)
        setEditContent(data.content)
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
                editKeyword={editKeyword}
                editYomi={editYomi}
                editContent={editContent}
                keyword={keyword}
                yomi={yomi}
                content={content}
                setKeyword={setKeyword}
                setYomi={setYomi}
                setContent={setContent}
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