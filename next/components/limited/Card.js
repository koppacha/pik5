import React, { useState } from 'react'
import useSWR from 'swr'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Typography from '@mui/material/Typography'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import Button from '@mui/material/Button'
import Box from "@mui/material/Box";
import Grid from "@mui/material/Grid";
import {Tooltip} from "@mui/material";
import {FontAwesomeIcon} from "@fortawesome/react-fontawesome";
import {faLightbulb, faRankingStar, faUsers} from "@fortawesome/free-solid-svg-icons";
import { styled } from "@mui/material/styles";
import Paper from "@mui/material/Paper";
import {addName2posts, fetcher} from "../../lib/pik5";
import NowLoading from "../NowLoading";
import RecordPost from "../modal/RecordPost";
import Record from "../record/Record";

// プレミアムステージの背景色（ボーダーカラー）
const gradientColor = "linear-gradient(145deg, rgba(255,157,2,1) 0%, rgba(241,221,10,1) 65%, rgba(164,250,247,1) 100%)"

const CardWrapper = styled(Paper)(({ premium }) => ({
    width: 280,
    height: 382,
    padding: 10,
    borderRadius: 16,
    background: `${premium}`,
    boxShadow: "4px 4px 10px rgba(0, 0, 0, 0.1)",
    transform: `rotate(2deg)`,
    transition: "transform 0.3s ease-in-out",
    position: "relative",
    zIndex: 1,
}));

const CardBackground = styled(Box)({
    width: 280,
    height: "100%",
    position: "absolute",
    top: 0,
    left: 0,
    backgroundColor: "#e1e1e1",
    borderRadius: 12,
    boxShadow: "4px 4px 10px rgba(0, 0, 0, 0.1)",
    transform: "rotate(0deg)",
    zIndex: 0,
});

const level2color = (level) => {
    switch (level) {
        case 1:
            return "#777";
        case 2:
            return "#777";
        case 3:
            return "#777";
        case 4:
            return "#cc47f1";
        case 5:
            return "#f1477e";
        default:
            return "#777";
    }
}

export default function CardItem({ session, card, region, users }) {
    const [open, setOpen] = useState(false)
    const { data: ranking, mutate } = useSWR(
        region === 'field' ? `/api/server/cards/${card.id}/scores` : null,
        fetcher,
        { refreshInterval: region === 'field' ? 10000 : 0 }
    )
    const {data, error} = useSWR(`/api/server/record/${card.id}`, fetcher)

    // カードのランキングを取得中の場合、ローディング表示
    if(!data || error) return <NowLoading/>

    const datas = addName2posts(data.data, users)

    const handleTake = async () => {
        await fetch(`/api/server/cards/${card.id}/take?userId=${session.user.id}`, { method: 'POST' })
        mutate()
        setOpen(false)
    }

    return (
        <>
            {/*表示されるカード*/}
            {/*<Card onClick={() => setOpen(true)}>*/}
            {/*    <CardContent>*/}
            {/*        <Typography variant="h6">{card.name}</Typography>*/}
            {/*        <Typography variant="body2">{card.rule_text}</Typography>*/}
            {/*        {region === 'field' && (*/}
            {/*            <>*/}
            {/*                <Typography variant="caption">テイカー: {card.taker}</Typography>*/}
            {/*                <Typography variant="caption">Mult: {card.mult}</Typography>*/}
            {/*            </>*/}
            {/*        )}*/}
            {/*    </CardContent>*/}
            {/*</Card>*/}

            <Grid item onClick={() => setOpen(true)} style={{cursor: "pointer"}}>
                <Box position="relative">
                    <CardBackground />
                    <CardWrapper premium={card.rarity > 4 ? gradientColor : "#777"}>
                        <div style={{background:"#fff",height:"100%",borderRadius:"16px",padding:"12px",display: "flex", flexDirection: "column"}}>
                            <Grid container style={{fontSize: 12, color: "#4b4b4b"}}>
                                <Grid item xs={3}>#{card.id}</Grid>
                                <Grid item xs={9} style={{textAlign:"right",color:level2color(card.difficulty)}}>{"★".repeat(card.difficulty)}</Grid>
                            </Grid>
                            <div style={{fontSize: 20, fontWeight: "bold"}}>{card.name}</div>
                            <div style={{fontSize: 16, color: "#666", marginTop: 4}}>{card.rule}</div>
                            <div style={{fontSize: 14, color: "#333", marginTop: 8, marginBottom: 8}}>{card.rule_text}</div>
                            <div style={{ marginTop: "auto" }}>
                                <hr/>
                                <Grid container style={{fontSize: 14, marginTop: 8}}>
                                    <Grid item xs={2}><Tooltip title={"参加者数"}><FontAwesomeIcon icon={faUsers} /> {card.user}</Tooltip></Grid>
                                    <Grid item xs={4}><Tooltip title={"トッププレイヤー"}><FontAwesomeIcon icon={faRankingStar} /> {card.top_player}</Tooltip></Grid>
                                    <Grid item xs={6} style={{textAlign:"right"}}><Tooltip title={"考案者"}><FontAwesomeIcon icon={faLightbulb} /> {card.creator}</Tooltip></Grid>
                                </Grid>
                            </div>
                        </div>
                    </CardWrapper>
                </Box>
            </Grid>
            {/*モーダルダイアログ*/}
            <Dialog open={open} onClose={() => setOpen(false)}>
                {region === 'hand' ? (
                    <>
                        <DialogTitle>このカードを場に出しますか？</DialogTitle>
                        <DialogActions>
                            <Button onClick={() => setOpen(false)}>キャンセル</Button>
                            <Button onClick={handleTake}>場に出す（テイク）</Button>
                        </DialogActions>
                    </>
                ) : (
                    <>
                        <DialogTitle>{card.title}</DialogTitle>
                        <DialogContent>
                            <RecordPost
                                style={{alignItems: "center"}}
                                info={data.data} rule={240421} console={0}/>
                            {
                                Object.values(datas).map(function (post) {
                                    return <Record mini={true} key={post.unique_id} data={post}/>
                                })
                            }
                        </DialogContent>
                        <DialogActions>
                            <Button onClick={() => setOpen(false)}>閉じる</Button>
                            <Button disabled={!ranking || ranking.length === 0}>投稿</Button>
                        </DialogActions>
                    </>
                )}
            </Dialog>
        </>
    )
}