import React, {useState} from "react";
import useSWR from "swr";
import {fetcher, id2name, useLocale} from "../../lib/pik5";
import NowLoading from "../NowLoading";
import {Box, ClickAwayListener, Grid, Tooltip} from "@mui/material";
import {CellBox, EventContainer, EventContent, TopBoxContent, TopBoxHeader} from "../../styles/pik5.css";
import {rule2array, selectable} from "../../lib/const";
import Link from "next/link";
import {FontAwesomeIcon} from "@fortawesome/react-fontawesome";
import {faBullhorn, faCircleInfo, faSplotch} from "@fortawesome/free-solid-svg-icons";
import ModalIdeaPost from "../modal/ModalIdeaPost";

export default function DashBoard({user}){

    const {t} = useLocale()
    const [open, setOpen] = useState(false)

    // 期間限定ルール投稿モーダル制御関連
    const [editOpen, setEditOpen] = useState(false)
    const [uniqueId, setUniqueId] = useState("")
    const handleEditOpen = () => setEditOpen(true)
    const handleEditClose = () => setEditOpen(false)

    const {data} = useSWR(`/api/server/user/total/${user?.id}`, fetcher)

    if(!data){
        return (
            <NowLoading/>
        )
    }
    // 暫定段位認定システム（15段階）
    const classes = ["6級 (D-)", "5級 (D)", "4級 (D+)", "3級 (C-)", "2級 (C)", "1級 (C+)",
        "初段 (B-)", "二段 (B)", "三段 (B+)", "四段 (A-)", "五段 (A)", "六段 (A+)", "七段 (S-)", "八段 (S)", "九段 (S+)"]
    const stageCounts = 210;
    const basePoints = [0, 50, 100, 150, 200, 250, 300, 500, 750, 1000, 1500, 2000, 3000, 4000, 5000]
    const cls = basePoints.findLastIndex(base => data.data.totals.rps > stageCounts * base)
    const nextPoints = (basePoints[cls + 1] * stageCounts) - data.data.totals.rps
    const notPostCategory = selectable.filter(value => !Object.keys(data.data.scores).map(Number).includes(value))

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
                <span style={{fontSize: "0.8em"}}>{classes[cls + 1]} まであと {nextPoints.toLocaleString()} 点</span>
            </TopBoxHeader>
            <TopBoxContent className="top-box-content">
            <Grid container>
                <Grid item xs={4}>
                    <CellBox>
                        <span className="cell-box-caption">全総合ランキング・段位認定</span><br/>
                        {classes[cls]}<br/>
                        <span className="cell-box-caption">{Number(data.data.totals.score).toLocaleString()} pts. / {Number(data.data.totals.rps).toLocaleString()} rps.</span>
                    </CellBox>
                </Grid>
                {
                    Object.keys(data.data.scores).map((series) =>
                        <Grid item xs={2} key={series}>
                            <Link href={`./total/${series}`}>
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
                                                    <Link href={`./total/${series}`}><li>{t.stage[series]}</li></Link>
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