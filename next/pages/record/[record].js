import * as React from "react";
import {Typography} from "@mui/material";
import {addName2posts, useLocale} from "../../lib/pik5";
import {PageHeader, RuleBox, StairIcon, TopBox, TopBoxContent, TopBoxHeader} from "../../styles/pik5.css";
import Link from "next/link";
import Head from "next/head";
import prisma from "../../lib/prisma";
import {FontAwesomeIcon} from "@fortawesome/react-fontawesome";
import {faArrowTrendUp, faHouseChimney, faPaperPlane, faStairs, faTrashCan} from "@fortawesome/free-solid-svg-icons";
import Record from "../../components/record/Record";
import {useSession} from "next-auth/react";
import NowLoading from "../../components/NowLoading";
import { useRouter } from "next/router";
import TrendRanking from "../../components/top/TrendRanking";

export async function getStaticPaths(){
    return {
        paths: [],
        fallback: 'blocking',
    }
}
// サーバーサイドの処理
export async function getStaticProps({params}){

    const record = params.record

    if(record < 100000000 || record > 400000000){
        return {
            notFound: true,
        }
    }
    // 記録をリクエスト
    const res = await fetch(`http://laravel:8000/api/record/id/${record}`)
    let data = await res.json()

    // 過去の投稿履歴を取得する
    const stage_res = await fetch(`http://laravel:8000/api/record/history/${data.stage_id}/${data.rule}/${data.user_id}`)
    let history = await stage_res.json()

    // スクリーンネームをリクエスト
    const users = await prisma.user.findMany({
        select: {
            userId: true,
            name: true,
            role: true
        }
    })
    // 表示中のユーザー名を取り出す
    data.user_name = users.find(function(e){
        return e.userId === data.user_id
    })?.name

    // 過去記録にスクリーンネームを注入
    history = addName2posts(history, users)

    return {
        props: {
            users, data, history
        },
        revalidate: 86400,
    }
}
export default function RecordPage({users, data, history}){

    const {t, r} = useLocale()
    const {data: session } = useSession()
    const router = useRouter()
    let role = 0

    if(session) {
        // セッションユーザーの情報を取り出す
        role = Number(users.find(function (e) {
            return e.userId === session.user.id
        }).role)
    }
    // 投稿の経過時間を計算
    const postDate = new Date(data.created_at)
    const now = new Date()

    // 削除権限を持っているかどうか判定する
    const delFlag = () => {
        // 管理人である場合は常に削除可能
        if(Number(role) === 10) return true

        // 管理人以外の場合、24時間経過していたら常にアウト
        if((postDate.getTime() + 86400000) < now.getTime()) return false

        // 24時間以内で投稿者本人の場合は削除可能
        if(session?.user.id === data.user_id) return true

        // 24時間以内で本人以外でもロールレベルが１以上なら削除可能、それ以外はアウト
        return role > 0;
    }

    async function handleOpen() {
        const confirm = window.confirm("本当に削除してよろしいですか？")
        if (confirm) {
            const res = await fetch(`/api/server/delete/${data.unique_id}/${users.userId}`)
            if(res.status < 300) {
                await router.push("/stage/" + data.stage_id)
                return null
            }
        }
    }
    if(!data){
        return (
            <NowLoading/>
        )
    }

    return (
        <>
            <Head>
                <title>{data.user_name+"/"+t.stage[data.stage_id]+" - "+t.title[0]}</title>
            </Head>
            {
                (data.flg > 1 || !data.unique_id) ?
                    <>
                        <Typography>この記録IDは存在しないか、すでに削除されています。</Typography>
                        <br/>
                        <Link href="/">トップページへ戻る</Link>
                    </>
                    :
                    <>
                        <PageHeader>
                            #{data?.unique_id || "?"}<br/>
                            <Link href="/"><FontAwesomeIcon icon={faHouseChimney}/></Link>
                            <StairIcon icon={faStairs}/>
                            <Link href={"/user/"+data.user_id}>{data.user_name}</Link>
                            <StairIcon icon={faStairs}/>
                            記録個別ページ<br/>
                            <Typography variant="" className="title">{ t.stage[data.stage_id] }</Typography><br/>
                            <Typography variant="" className="subtitle">{r.stage[data.stage_id]}</Typography><br/><br/>
                        </PageHeader>
                        <Record key={data.unique_id} data={data}/>
                        {
                            (delFlag()) &&
                                <RuleBox
                                    className="active"
                                    href="#"
                                    style={{width: 200}}
                                    onClick={handleOpen}>
                                    <FontAwesomeIcon style={{color:"#868686"}} icon={faTrashCan} /> この記録を削除する
                                </RuleBox>
                        }
                        <TopBox style={{marginTop:"4em"}} >
                            <TopBoxHeader className="top-box-header">
                                <span><FontAwesomeIcon icon={faArrowTrendUp}/> 過去の記録</span>
                            </TopBoxHeader>
                            <TopBoxContent className="top-box-content">
                                {
                                    history?.map(function(post){
                                        return (
                                            <React.Fragment key={post.unique_id}>
                                                <Record key={post.unique_id} data={post} history={true} />
                                            </React.Fragment>
                                        )
                                    })
                                }
                            </TopBoxContent>
                        </TopBox>
                    </>
            }
        </>
    )
}
