import React, {useState} from "react";
import useSWR from "swr";
import {fetcher, id2name, useLocale} from "../../lib/pik5";
import NowLoading from "../NowLoading";
import {Box, ClickAwayListener, Grid, Tooltip} from "@mui/material";
import {CellBox, EventContainer, EventContent, TopBoxContent, TopBoxHeader} from "../../styles/pik5.css";
import {rule2array, selectable} from "../../lib/const";
import Link from "next/link";
import {FontAwesomeIcon} from "@fortawesome/react-fontawesome";
import {faBullhorn, faCircleInfo, faFlag, faSplotch} from "@fortawesome/free-solid-svg-icons";
import ModalIdeaPost from "../modal/ModalIdeaPost";

export default function DashBoard({user, users}){

    const {t} = useLocale()
    const [open, setOpen] = useState(false)

    // 期間限定ルール投稿モーダル制御関連
    const [editOpen, setEditOpen] = useState(false)
    const [uniqueId, setUniqueId] = useState("")
    const handleEditOpen = () => setEditOpen(true)
    const handleEditClose = () => setEditOpen(false)

    const {data} = useSWR(`/api/server/user/total/${user?.id}`, fetcher)
    const {data:totalRanking} = useSWR(`/api/server/user/rank/0`, fetcher)

    if(!data){
        return (
            <>
                <TopBoxHeader className="top-box-header">
                    <span><FontAwesomeIcon icon={faCircleInfo} />{user?.name || "不明な葉っぱ人"}さんのダッシュボード</span>
                </TopBoxHeader>
                <TopBoxContent className="top-box-content">
                    <Grid container>
                        {Array.from({ length: 12 }).map((_, index) => (
                            <Grid item xs={4} sm={3} md={2} key={index}>
                                <CellBox>
                                    {index === 0 && <NowLoading />}
                                </CellBox>
                            </Grid>
                        ))}
                    </Grid>
                </TopBoxContent>
            </>
        )
    }
    // 暫定段位認定システム（15段階）
    const classes = ["6級 (D1)", "5級 (D2)", "4級 (D3)", "3級 (C1)", "2級 (C2)", "1級 (C3)",
        "初段 (B1)", "二段 (B2)", "三段 (B3)", "四段 (A1)", "五段 (A2)", "六段 (A3)", "七段 (S1)", "八段 (S2)", "九段 (S3)", "理論値（Lim.）"]
    const stageCounts = 210;
    const basePoints = [0, 50, 100, 150, 200, 250, 300, 500, 750, 1000, 1500, 2000, 3000, 4000, 5000, 20000]
    const cls = basePoints.findLastIndex(base => data.data.totals.rps > stageCounts * base)
    const clas = (rps) => basePoints.findLastIndex(base => rps >= stageCounts * base)
    const nextPoints = (basePoints[cls + 1] * stageCounts) - data.data.totals.rps
    const notPostCategory = selectable.filter(value => !Object.keys(data.data.scores).map(Number).includes(value))

    const rivals = getSurroundingRanking(totalRanking?.data, data.data.totals.rps, (basePoints[cls + 1] * stageCounts))

    // 前後プレイヤー５名を抽出する関数
    function getSurroundingRanking(totalRanking, userRps, checkPoint = 0) {
        const userIndex = totalRanking.findIndex(item => item.rps === userRps);

        if (userIndex === -1) {
            throw new Error("User not found in the ranking.");
        }

        const totalCount = totalRanking.length;

        // 抽出範囲の計算
        let start = Math.max(0, userIndex - 2); // 上位2名分
        let end = Math.min(totalCount, userIndex + 3); // 本人＋下位2名分

        // 上位や下位の不足分を補う
        const above = Math.max(0, 2 - userIndex); // 上位不足数
        const below = Math.max(0, (userIndex + 3) - totalCount); // 下位不足数

        start = Math.max(0, start - below); // 上位不足を下位から補う
        end = Math.min(totalCount, end + above); // 下位不足を上位から補う

        // 必ず5名を抽出するための調整
        if (end - start < 5) {
            if (start === 0) {
                end = Math.min(totalCount, 5); // 上位が不足していれば下位を広げる
            } else if (end === totalCount) {
                start = Math.max(0, totalCount - 5); // 下位が不足していれば上位を広げる
            }
        }

        let result = totalRanking.slice(start, end);

        // checkPointを加える
        if (checkPoint > 0) {
            const checkPointEntry = { user: "checkPoint", rps: checkPoint };

            // 既存のリストにcheckPointを追加し、rps降順にソート
            result.push(checkPointEntry);
            result.sort((a, b) => a.rps - b.rps);

            // 結果を再度5名に絞り込む
            result = result.slice(0, 6);
        }

        return result;
    }
    // その他メニューの開閉制御
    const handleTooltipClose = () => {
        setOpen(false);
    }
    const handleTooltipOpen = () => {
        setOpen(true);
    }
    return (
        <>
            <TopBoxHeader className="top-box-header">
                <span><FontAwesomeIcon icon={faCircleInfo} />{user?.name || "不明な葉っぱ人"}さんのダッシュボード</span>
                {
                    (cls < classes.length - 2) ?
                        <span style={{fontSize: "0.8em"}}>{classes[cls + 1]} まであと {nextPoints.toLocaleString()} 点</span>
                        :
                        <span style={{fontSize: "0.8em"}}>最高段位に到達しました！</span>
                }


            </TopBoxHeader>
            <TopBoxContent className="top-box-content">
            <Grid container>
                {
                    rivals.map(player =>
                        <Grid item xs={2}>
                            <CellBox className={player?.user === user?.id && "active"}>
                                <span className="cell-box-caption">{player?.rank && <>{player?.rank}位 / {classes[clas(player?.rps)]}</>}</span><br/>
                                {player?.user !== "checkPoint" ? id2name(users, player?.user) : (cls < classes.length - 2) ? classes[cls + 1] : <FontAwesomeIcon icon={faFlag} />}<br/>
                                <span className="cell-box-caption">{(player?.rps < 4200000) && <>{Number(player?.rps).toLocaleString()} rps.</>}</span>
                            </CellBox>
                        </Grid>
                    )
                }
                {
                    Object.keys(data.data.scores).map((series) =>
                        <Grid item xs={4} sm={3} md={2} key={series}>
                            <Link href={`/total/${series}`}>
                                <CellBox>
                                    <span className="cell-box-caption">{t.subtitle[series]}</span><br/>
                                    {Number(data.data.scores[series]).toLocaleString()} <span className=".score-tail" style={{fontSize:"0.8em"}}>pts.</span><br/>
                                    <span className="cell-box-caption">
                                        {data.data.marks[series]}/{rule2array(series).length}
                                        {(data.data.marks[series] >= rule2array(series).length) ? <FontAwesomeIcon className="complete-star" icon={faSplotch} /> : ""}
                                    </span>
                                </CellBox>
                            </Link>
                        </Grid>
                    )
                }
                {
                    (notPostCategory.length > 0) && (
                        <ClickAwayListener onClickAway={handleTooltipClose}>
                            <Grid item xs={2} key={0}>
                                <Tooltip
                                    PopperProps={{
                                        disablePortal: true,
                                    }}
                                    onClose={handleTooltipClose}
                                    open={open}
                                    disableFocusListener
                                    disableHoverListener
                                    disableTouchListener
                                    title={
                                    <>
                                        <ul className="dashboard-tooltip-list">
                                            {
                                                notPostCategory.map((series) => (
                                                    <Link key={series} href={`./total/${series}`}><li>{t.stage[series]}</li></Link>
                                                ))
                                            }
                                        </ul>
                                    </>
                                }>
                                    <CellBox onClick={handleTooltipOpen} style={{cursor: "pointer"}}>
                                        <br/>
                                        その他<br/>
                                    </CellBox>
                                </Tooltip>
                            </Grid>
                        </ClickAwayListener>
                    )
                }
            </Grid>
                <EventContainer>
                    <EventContent>
                        <Link href="#" onClick={handleEditOpen}>
                            <EventContent style={{
                                textDecoration: "underline",
                                float: "left",
                                width: "50%",
                                backgroundColor: "#333",
                                borderRadius: "4px",
                                padding: "8px",
                                textAlign: "center"
                            }}>
                                期間限定ルールを投稿する<br/>
                            </EventContent>
                        </Link>
                        <Link href="/keyword?c=idea">
                            <EventContent style={{
                                textDecoration: "underline",
                                float: "right",
                                width: "48%",
                                backgroundColor: "#333",
                                borderRadius: "4px",
                                padding: "8px",
                                textAlign: "center"
                            }}>
                                ルールを確認・編集する
                            </EventContent>
                        </Link>
                    </EventContent>
                </EventContainer>
                <Box style={{
                    borderTop: "1px solid #777",
                    fontSize: "0.8em",
                    color: "#999",
                    textAlign: "right",
                    display: "none"
                }}>
                    <FontAwesomeIcon icon={faBullhorn}/> イベント告知チャンネルに投稿されたイベントは順次掲載していきます。
                </Box>
            </TopBoxContent>
            <ModalIdeaPost editOpen={editOpen} uniqueId={uniqueId} handleEditClose={handleEditClose} handleEditOpen={handleEditOpen}/>

        </>
    )
}