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
            const {userId, unique_id, stage_id, type} = fuse.search(search)[0]?.item

            if(userId){
                router.push(`/user/${userId}`).then(r => handleClose())
            } else if(unique_id){
                router.push(`/keyword/${unique_id}`).then(r => handleClose())
            } else if(stage_id){
                router.push(`/${type}/${stage_id}`).then(r => handleClose())
            }
        }
    }

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
    let result = stages.data?.concat(keywords.data)

    if(users){
        // ユーザー情報も取得できていればそれも結合する
        result = result?.concat(users)
    }

    const fuse = new Fuse(result, fuseOptions)

    return (
        <>
            <Dialog open={open} onClose={handleClose} fullWidth>
                <DialogContent style={{height: '100vh'}}>
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
                        fuse.search(search).map(function (post, idx) {

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
                                    <Link key={idx} variant="overline" href={"/keyword/"+post.item.unique_id} onClick={handleClose}>
                                        <SearchResultItem index={idx}>
                                            <FontAwesomeIcon icon={faBook} />
                                                {post.item.keyword}
                                            <SearchResultTag color={color}>{t.keyword.category[post.item?.category]}</SearchResultTag>
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
                </DialogContent>
                <DialogActions>
                    <Button onClick={handleClose}>閉じる</Button>
                </DialogActions>
            </Dialog>
        </>
    )
}