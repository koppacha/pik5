import {fetcher, mergeDeeply, useLocale} from "../../lib/pik5";
import React, {useEffect, useState} from "react";
import Fuse from "fuse.js";
import TextField from "@mui/material/TextField";
import * as yup from "yup";
import {useForm} from "react-hook-form";
import {yupResolver} from "@hookform/resolvers/yup";
import DialogActions from "@mui/material/DialogActions";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import useSWR from "swr";
import NowLoading from "../NowLoading";
import {Box, List, ListItem, Typography} from "@mui/material";
import Link from "next/link";
import {SearchResultTag} from "../../styles/pik5.css";

export default function ModalSearch({users, open, handleClose, searchRef}) {

    const [search, setSearch] = useState("")

    // モーダルが開いたら100ms後にフォーカスする
    useEffect(() => {
        const timeout = setTimeout(() => {
            searchRef.current?.focus()
        }, 100)

        return () => {
            clearTimeout(timeout)
        }
    })

    const fuseOptions = {
        isCaseSensitive: false,
        includeScore: false,
        shouldSort: true,
        includeMatches: false,
        findAllMatches: false,
        minMatchCharLength: 2,
        location: 0,
        threshold: 0.4,
        distance: 500,
        useExtendedSearch: false,
        ignoreLocation: false,
        ignoreFieldNorm: false,
        fieldNormWeight: 1,
        keys: ['stage_id', 'stage_name', 'eng_stage_name', 'parent',
            'id', 'unique_id', 'category', 'keyword', 'tag', 'yomi', 'content',
            'userId', 'name']
    };

    const {t} = useLocale()

    // ステージ情報全取得
    const {data: stages} = useSWR(`/api/server/stage/all`, fetcher)

    // キーワード全取得
    const {data: keywords} = useSWR(`/api/server/keyword`, fetcher)

    if (!stages || !keywords) {
        return (
            <>
                <NowLoading/>
            </>
        )
    }

    // 得られたオブジェクトを結合する
    let result = stages.data.concat(keywords.data)

    if(users){
        // ユーザー情報も取得できていればそれも結合する
        result = result.concat(users)
    }

    const fuse = new Fuse(result, fuseOptions)

    return (
        <>
            <Dialog open={open} onClose={handleClose}>
                <TextField
                    id="search"
                    label="検索キーワード"
                    type="text"
                    onChange={(e) => setSearch(e.target.value)}
                    fullWidth
                    variant="standard"
                    value={search}
                    margin="normal"
                    inputRef={searchRef}
                />
                <List style={{width:"100%"}}>
                {
                    fuse.search(search).map(function (post) {

                        let color

                        // ステージ
                        if(post.item?.stage_name){

                            color = "#d98778"

                            return (
                                <ListItem>
                                    <Link href={"/stage/"+post.item.stage_id} onClick={handleClose}>
                                        {post.item.stage_name}
                                    </Link>
                                    <SearchResultTag color={color}>ステージ</SearchResultTag>
                                    {
                                        (post.item?.parent < 100) ?
                                            <SearchResultTag color={color}>{t.subtitle[post.item.parent]}</SearchResultTag>
                                            :
                                            <SearchResultTag color={color}>{t.limited[post.item.parent]}</SearchResultTag>
                                    }
                                </ListItem>
                            )
                        }

                        // キーワード
                        if(post.item?.keyword){

                            color = "#78d9c8"

                            return (
                                <ListItem>
                                    <Link variant="overline" href={"/keyword/"+post.item.unique_id} onClick={handleClose}>
                                        {post.item.keyword}
                                    </Link>
                                    <SearchResultTag color={color}>キーワード</SearchResultTag>
                                    <SearchResultTag color={color}>{t.keyword.category[post.item?.category]}</SearchResultTag>
                                </ListItem>
                            )
                        }

                        // ユーザー
                        if(post.item?.name) {

                            color = "#7880d9"

                            return (
                                <ListItem>
                                    <Link href={"/user/"+post.item.userId} onClick={handleClose}>
                                        {post.item.name}
                                    </Link>
                                    <SearchResultTag color={color}>ユーザー</SearchResultTag>
                                </ListItem>
                            )
                        }
                    })
                }
                </List>
                <DialogActions>
                    <Button onClick={handleClose}>閉じる</Button>
                </DialogActions>
            </Dialog>
        </>
    )
}