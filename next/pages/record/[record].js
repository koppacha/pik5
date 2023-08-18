import * as React from "react";
import {Typography} from "@mui/material";
import {useLocale} from "../../lib/pik5";
import {PageHeader, RecordPostButton, StairIcon} from "../../styles/pik5.css";
import Link from "next/link";
import Head from "next/head";
import prisma from "../../lib/prisma";
import {FontAwesomeIcon} from "@fortawesome/react-fontawesome";
import {faHouseChimney, faPaperPlane, faStairs, faTrashCan} from "@fortawesome/free-solid-svg-icons";
import Record from "../../components/record/Record";
import {useSession} from "next-auth/react";
import NowLoading from "../../components/NowLoading";
import { useRouter } from "next/router";

// サーバーサイドの処理
export async function getServerSideProps(context){

    const record = context.query.record

    if(record < 100000000 || record > 400000000){
        return {
            notFound: true,
        }
    }
    // 記録をリクエスト
    const res = await fetch(`http://laravel:8000/api/record/id/${record}`)
    let data = await res.json()

    // 該当ステージの情報を取得する
    const stage_res = await fetch(`http://laravel:8000/api/stage/${data.stage_id}`)
    const info = await stage_res.json()

    // スクリーンネームをリクエスト
    const users = await prisma.user.findFirst({
        select: {
            userId: true,
            name: true
        },
        where: {
            userId: data.user_id
        }
    })
    data['user_name'] = users?.name

    return {
        props: {
            users, data, info
        }
    }
}
export default function RecordPage({users, data}){

    const {t, r} = useLocale()
    const {data: session } = useSession()
    const router = useRouter()

    // 投稿の経過時間を計算
    const postDate = new Date(data.created_at)
    const now = new Date()

    const timeFlag = ((postDate.getTime() + 86400000) < now.getTime())

    async function handleOpen() {
        const confirm = window.confirm("本当に削除してよろしいですか？")
        if (confirm) {
            const res = await fetch(`/api/server/delete/${data.unique_id}/${users.userId}`)
            if(res.status < 300) {
                await router.push("/stage/" + data.stage_id)
            }
        }
    }
    if(!session || !data){
        return (
            <NowLoading/>
        )
    }
    return (
        <>
            <Head>
                <title>{users?.name+"/"+t.stage[data.stage_id]+" - "+t.title[0]}</title>
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
                            <Link href={"/user/"+users?.userId}>{users?.name}</Link>
                            <StairIcon icon={faStairs}/>
                            記録個別ページ<br/>
                            <Typography variant="" className="title">{ t.stage[data.stage_id] }</Typography><br/>
                            <Typography variant="" className="subtitle">{r.stage[data.stage_id]}</Typography><br/><br/>
                        </PageHeader>
                        <Record data={data}/>

                        {
                            (session.user.id === users.userId && !timeFlag) &&
                                <RecordPostButton
                                    className="active"
                                    href="#"
                                    style={{width: 200}}
                                    onClick={handleOpen}>
                                    <FontAwesomeIcon style={{color:"#868686"}} icon={faTrashCan} /> この記録を削除する
                                </RecordPostButton>
                        }
                    </>
            }
        </>
    )
}
