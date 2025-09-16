import Button from "@mui/material/Button";
import {Box, Typography} from "@mui/material";
import ReactMarkdown from "react-markdown";
import {KeywordContent} from "../../components/modal/KeywordContent";
import Link from "next/link";
import {FontAwesomeIcon} from "@fortawesome/react-fontawesome";
import {faHouseChimney, faStairs} from "@fortawesome/free-solid-svg-icons";
import {StairIcon} from "../../styles/pik5.css";
import React from "react";
import {useLocale} from "../../lib/pik5";
import Head from "next/head";
import prisma from "../../lib/prisma";
import dynamic from 'next/dynamic'
import {useSession} from "next-auth/react";

const ModalKeywordEdit = dynamic(() => import('../../components/modal/ModalKeywordEdit'), { ssr: false })

export async function getStaticPaths(){
    return {
        paths: [],
        fallback: 'blocking',
    }
}
export async function getStaticProps({ params }) {
    const id = params.keyword

    // 解決 API を呼ぶ
    const res = await fetch(`http://laravel:8000/api/keyword/resolve/${id}`)
    const payload = await res.json()

    if (!res.ok || payload?.mode === 'notfound') {
        return {
            props: {
                notfound: true,
                id
            },
            revalidate: 60
        }
    }

    // 既存のスクリーンネーム一覧（検索用）
    const users = await prisma.user.findMany({
        select: { userId: true, name: true }
    })

    return {
        props: {
            payload, users, id
        },
        revalidate: 60
    }
}

export default function Keyword({payload, users, notfound, id}) {

    const [open, setOpen] = React.useState(false)
    const handleOpen = () => setOpen(true)
    const handleClose = () => setOpen(false)

    const { t } = useLocale()
    const {data: session } = useSession()

    const canView = (item) => {
      if (!item) return false
      if (item.tag === '期間限定チャレンジ') {
        const uid = session?.user?.id
        if (!uid) return false
        return uid === 'koppacha' || uid === item.last_editor
      }
      return true
    }

    if (notfound) {
      return (
        <>
          <Head>
            <title>{`未作成 - ${t.title[0]}`}</title>
          </Head>
          <Box className='page-header'>
            <Link href='/'><FontAwesomeIcon icon={faHouseChimney} /></Link>
            <StairIcon icon={faStairs} />
            <Link href='/keyword'>{t.g.keyword}</Link>
            <br/>

            <Typography variant='h6' gutterBottom>
              この記事はまだ作成されていません。
            </Typography>
            <Box sx={{ display: 'flex', gap: 2, mt: 2 }}>
              <Button type='button' variant='contained' onClick={handleOpen}>記事を新規作成</Button>
              <Link href='/keyword' passHref legacyBehavior>
                <Button type='button' variant='outlined' component='a'>キーワードトップに戻る</Button>
              </Link>
            </Box>

            <ModalKeywordEdit uniqueId={0} editOpen={open} handleEditClose={handleClose} />
          </Box>
        </>
      )
    }

    const { mode, parent, children = [] } = payload

    // タイトルの候補
    const titleBase =
        mode === 'parent'
            ? (parent?.keyword ?? `${children[0]?.tag}`)
            : parent?.keyword

    return (
        <>
            <Head>
                <title>{(titleBase ? `${titleBase} - ` : '') + t.title[0]}</title>
            </Head>

            <Box className='page-header'>
                <Link href='/'><FontAwesomeIcon icon={faHouseChimney} /></Link>
                <StairIcon icon={faStairs} />
                <Link href='/keyword'>{t.g.keyword}</Link>
                <br/>

                {/* 親（unique_id === id が存在するなら最初に表示） */}
                {parent && (
                  canView(parent)
                    ? <KeywordContent data={parent} users={users} />
                    : <Box style={{margin:"10px"}}>閲覧権限がありません</Box>
                )}

                {/* 親モードの時は子を列挙表示 */}
                {mode === 'parent' && children.map(row => (
                  canView(row)
                    ? <KeywordContent key={row.unique_id} data={row} users={users} />
                    : <Box style={{margin:"10px"}} key={row.unique_id}>閲覧権限がありません</Box>
                ))}

                {/* ユニーク表示モードなら親のみで終わり */}
            </Box>
        </>
    )
}