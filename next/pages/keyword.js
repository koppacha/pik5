import {Box, Typography} from "@mui/material";
import ModalFormKeyword from "../components/ModalFormKeyword";
import KeywordPost from "../components/KeywordPost";
import Button from "@mui/material/Button";
import React, {useEffect, useRef, useState} from "react";
import useSWR from "swr";
import {fetcher} from "../plugin/pik5";
import {InfoBox, StairIcon} from "../styles/pik5.css";
import Link from "next/link";
import {FontAwesomeIcon} from "@fortawesome/react-fontawesome";
import {faHouseChimney, faStairs} from "@fortawesome/free-solid-svg-icons";

export default function Keyword(){

    const {data} = useSWR(`http://localhost:8000/api/keyword`, fetcher)

    // 送信ボタン押下時にデータをポストする
    const [tag, setTag] = useState("")
    const [keyword, setKeyword] = useState("")
    const [yomi, setYomi] = useState("")
    const [content, setContent] = useState("")
    const [uniqueId, setUniqueId] = useState("")
    const [firstEditor, setFirstEditor] = useState("")

    // 編集ボタン押下時にデータをリクエストして渡す
    const [editTag, setEditTag] = useState("")
    const [editKeyword, setEditKeyword] = useState("")
    const [editYomi, setEditYomi] = useState("")
    const [editContent, setEditContent] = useState("")
    const [editUniqueId, setEditUniqueId] = useState("")
    const [editFirstEditor, setEditFirstEditor] = useState("")

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
        setFirstEditor("")
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
        setFirstEditor(data.first_editor)
        setEditTag(data.tag)
        setEditKeyword(data.keyword)
        setEditYomi(data.yomi)
        setEditContent(data.content)
        setEditUniqueId(data.unique_id)
        setEditFirstEditor(data.first_editor)
        setOpen(true)
    }

    return (
        <>
            <Link href="/"><FontAwesomeIcon icon={faHouseChimney}/></Link>
            <StairIcon icon={faStairs}/>
            <Typography variant="">その他コンテンツ</Typography><br/>
            <Typography variant="" className="title">ピクミンキーワード</Typography><br/>
            <Typography variant="" className="subtitle">Pikmin Keywords</Typography><br/>
            <InfoBox>
            ピクミンシリーズ、ピクチャレ大会、ピクミン界隈にまつわる専門用語や流行語などをなんでも保存しておくためのページです。基本的にどなたでも編集できます。
                <Box style={{ margin: '1em'}}>
                    <ul>
                        <li>登録できるのはピクミン界隈にある程度受け入れられている言葉に限ります。作成者以外に認知されていない造語等は削除対象です。</li>
                        <li>キーワード名及び本文は簡潔でわかりやすい表現を心がけてください。</li>
                        <li>キーワード名単独でどのシリーズやステージの用語か分かりにくい場合は（）でステージ名等を付け加えてください。その際、よみがなにカッコ及びカッコ内を含める必要はありません。</li>
                        <li>本文中のゲームタイトルは『』で囲んでください。強調したい言葉は「」で囲んでください。（キーワード名に含まれれる場合は不要）</li>
                        <li>本文にプレイヤー名を記述する場合は末尾に「氏」をつけてください。（キーワード名にプレイヤー名が含まれる場合は敬称略としてください）</li>
                        <li>利用規約やレギュレーションなど一部のキーワードには編集権限が必要になります。</li>
                    </ul>
                </Box>
            </InfoBox>
            <Button variant="outlined" onClick={handleClickOpen}>
                キーワードを新規作成
            </Button>
            <ModalFormKeyword
                handleClose={handleClose}
                handleClickOpen={handleClickOpen}
                editTag={editTag}
                editKeyword={editKeyword}
                editYomi={editYomi}
                editContent={editContent}
                editUniqueId={editUniqueId}
                editFirstEditor={editFirstEditor}
                tag={tag}
                keyword={keyword}
                yomi={yomi}
                content={content}
                uniqueId={uniqueId}
                firstEditor={firstEditor}
                setTag={setTag}
                setKeyword={setKeyword}
                setYomi={setYomi}
                setContent={setContent}
                setUniqueId={setUniqueId}
                setFirstEditor={setFirstEditor}
                open={open}
                setOpen={setOpen}/>
            {
                data?.map(post =>
                    <KeywordPost data={post} handleEdit={() => handleEdit}/>
                )
            }
        </>
    )
}