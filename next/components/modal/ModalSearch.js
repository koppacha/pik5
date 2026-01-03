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
import {SearchResultItem, SearchResultTag} from "../../styles/pik5.css";
import {faBook, faRankingStar, faUser} from "@fortawesome/free-solid-svg-icons";
import {FontAwesomeIcon} from "@fortawesome/react-fontawesome";
import {useRouter} from "next/router";
import DialogContent from "@mui/material/DialogContent";

export default function ModalSearch({users, open, handleClose, searchRef}) {

    const [search, setSearch] = useState("")
    const router = useRouter()


    const fuseOptions = {
        isCaseSensitive: false,
        includeScore: false,
        shouldSort: true,
        includeMatches: false,
        findAllMatches: false,
        minMatchCharLength: 1,
        location: 0,
        threshold: 0.4,
        distance: 1000,
        useExtendedSearch: true,
        ignoreLocation: false,
        ignoreFieldNorm: false,
        fieldNormWeight: 1,
        keys: [
            {name: 'stage_id', weight: 2}, {name: 'stage_name', weight: 2}, {name: 'eng_stage_name', weight: 2}, 'parent',
            'category', 'keyword', 'tag', 'yomi', 'content',
            {name: 'userId', weight: 2}, {name: 'name', weight: 2}]
    };

    const {t} = useLocale()

    const handleKeyDown = (e) => {
        if(e.key === 'Enter'){
            if(!fuse) return
            const {userId, unique_id, stage_id, type, keyword} = fuse.search(search)[0]?.item ?? {}

            if(userId){
                router.push(`/user/${userId}`).then(r => handleClose())
            } else if(unique_id){
                router.push(`/keyword/${keyword}`).then(r => handleClose())
            } else if(stage_id){
                router.push(`/${type}/${stage_id}`).then(r => handleClose())
            }
        }
    }

    // 検索データはモーダルを開いてから取得する（転送量が大きいので常時取得しない）
    const shouldFetch = open

    // ステージ情報全取得
    const {data: stages} = useSWR(
        shouldFetch ? `/api/server/stage/all` : null,
        fetcher,
        {revalidateOnFocus: false, revalidateOnReconnect: false}
    )

    // キーワード全取得
    const {data: keywords} = useSWR(
        shouldFetch ? `/api/server/keyword` : null,
        fetcher,
        {revalidateOnFocus: false, revalidateOnReconnect: false}
    )

    // モーダルが開いており、検索データが揃ったら100ms後にフォーカスする
    useEffect(() => {
        if(!open) return
        if(!stages || !keywords) return

        const timeout = setTimeout(() => {
            searchRef.current?.focus()
        }, 100)

        return () => {
            clearTimeout(timeout)
        }
    }, [open, stages, keywords, searchRef])

    let result = []
    let fuse = null
    let searchResults = []

    // モーダルが開いていて、検索データが揃っているときだけ検索インデックスを作る
    if(open && stages?.data && keywords?.data){
        // 得られたオブジェクトを結合する
        result = stages.data.concat(keywords.data)

        if(users){
            // ユーザー情報も取得できていればそれも結合する
            result = result.concat(users)
        }

        fuse = new Fuse(result, fuseOptions)
        searchResults = fuse?.search(search) ?? []
    }

    return (
        <>
            <Dialog open={open} onClose={handleClose} fullWidth>
                <DialogContent style={{height: '100vh'}}>
                    {
                        (!stages || !keywords)
                            ? <NowLoading/>
                            : <>
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
                                    onKeyDown={handleKeyDown}
                                />
                                <List style={{width:"100%"}}>
                                {
                                    searchResults.map(function (post, idx) {

                                        let color

                                        // ステージ
                                        if(post.item?.stage_name){

                                            color = "#e55fb6"

                                            return (
                                                <Link key={idx} href={"/"+post.item.type+"/"+post.item.stage_id} onClick={handleClose}>
                                                    <SearchResultItem index={idx}>
                                                        <FontAwesomeIcon icon={faRankingStar} />

                                                            {post.item.stage_name}
                                                        {
                                                            (post.item?.parent < 100) ?
                                                                (!post.item?.parent) || // ←parentが0以下ならカテゴリ名は表示しない
                                                                <SearchResultTag color={color}>{t.subtitle[post.item.parent]}</SearchResultTag>
                                                                :
                                                                <SearchResultTag color={color}>{t.limited[post.item.parent]}</SearchResultTag>
                                                        }
                                                    </SearchResultItem>
                                                </Link>
                                            )
                                        }

                                        // キーワード
                                        if(post.item?.keyword){

                                            color = "#4decce"
                                            if(post.item?.category === "rule") return null

                                            return (
                                                <Link key={idx} variant="overline" href={"/keyword/"+post.item.keyword} onClick={handleClose}>
                                                    <SearchResultItem index={idx}>
                                                        <FontAwesomeIcon icon={faBook} />
                                                            {post.item.keyword}
                                                        <SearchResultTag color={color}>{post.item?.tag || "その他"}</SearchResultTag>
                                                    </SearchResultItem>
                                                </Link>
                                            )
                                        }

                                        // ユーザー
                                        if(post.item?.name) {

                                            color = "#5b68f3"

                                            return (
                                                <Link key={idx} href={"/user/"+post.item.userId} onClick={handleClose}>
                                                    <SearchResultItem index={idx}>
                                                        <FontAwesomeIcon icon={faUser} />
                                                            {post.item.name}
                                                        <SearchResultTag color={color} style={{color:"#fff"}}>{t.g.userName}</SearchResultTag>
                                                    </SearchResultItem>
                                                </Link>
                                            )
                                        }
                                    })
                                }
                                </List>
                              </>
                    }
                </DialogContent>
                <DialogActions>
                    <Button onClick={handleClose}>閉じる</Button>
                </DialogActions>
            </Dialog>
        </>
    )
}