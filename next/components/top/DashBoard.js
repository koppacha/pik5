import React, {useState} from "react";
import useSWR from "swr";
import {currentYear, fetcher, id2name, rankColor, useLocale} from "../../lib/pik5";
import NowLoading from "../NowLoading";
import {Box, ClickAwayListener, Grid, Tooltip} from "@mui/material";
import {CellBox, EventContainer, EventContent, TopBoxContent, TopBoxHeader} from "../../styles/pik5.css";
import {rule2array, selectable} from "../../lib/const";
import Link from "next/link";
import {FontAwesomeIcon} from "@fortawesome/react-fontawesome";
import {faBullhorn, faCircleInfo, faCircleQuestion, faFlag, faSplotch} from "@fortawesome/free-solid-svg-icons";
import ModalIdeaPost from "../modal/ModalIdeaPost";

export default function DashBoard({user, users}){

    const {t} = useLocale()
    const [open, setOpen] = useState(false)

    const {data} = useSWR(`/api/server/user/total/${user?.id}`, fetcher)
    const {data:totalRanking} = useSWR(`/api/server/user/rank/0`, fetcher)

    if(!data || !totalRanking){
        return (
            <>
                <TopBoxHeader className="top-box-header">
                    <span><FontAwesomeIcon icon={faCircleInfo} />ダッシュボード</span>
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
    // 暫定段位認定システム
    const stageCounts = 208;
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
            return []
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
                <span><FontAwesomeIcon icon={faCircleInfo} />ダッシュボード</span>
                {
                    (cls < 14) ?
                        <span style={{fontSize: "0.8em"}}>{t.classes[cls + 1]} まであと {nextPoints.toLocaleString()} 点</span>
                        :
                        <span style={{fontSize: "0.8em"}}>最高段位に到達しました！</span>
                }
            </TopBoxHeader>
            <TopBoxContent className="top-box-content">
                <Box className="top-box-caption">総合ランキング / ライバルリスト <Tooltip title={`ランクポイントは投稿ステージの順位に応じてもらえるポイントです。より人気なステージで上位なほど得点が多くもらえます。段位はステージ数に特定の係数を掛けることで算出されるポイントを超えると認定されます。最高段位（九段）に到達したプレイヤーのうち最高点数保持者には「名人」タイトルが授与されます。現在の対象ステージは210ステージです。`}><FontAwesomeIcon icon={faCircleQuestion} /></Tooltip></Box>
            <Grid container>
                {
                    rivals.map(player => {
                        const isActive = player?.user === user?.id;
                        const isCheckPoint = player?.user === "checkPoint";
                        const cellContent = (
                            <CellBox className={`cell-box ${isActive ? "active" : ""}`}>
                                {/* 1行目: 順位とクラス */}
                                <span className="cell-box-caption">
                                {player?.rank ? (
                                    <>
                                        {player?.rank}位 / {clas(player?.rps) === 14 && player?.rank === 1 ? t.classes[15] : t.classes[clas(player?.rps)]}
                                    </>
                                ) : (<><FontAwesomeIcon icon={faFlag}/></>)}
                                    </span><br/>
                                    {/* 2行目: ユーザー名または特別な表示 */}
                                    {!isCheckPoint ? (
                                        id2name(users, player?.user)
                                    ) : cls < 14 ? (
                                        t.classes[cls + 1]
                                    ) : ""}
                                    <br/>
                                    {/* 3行目: RPS表示 */}
                                    <span className="cell-box-caption">
                    {player?.rps < 4200000 && (
                        <>{Number(player?.rps).toLocaleString()} rps.</>
                    )}
                </span>
                            </CellBox>
                    );

                    return (
                            <Grid item
                                  xs={4}
                                  lg={isCheckPoint ? 1.5 : isActive ? 2.5 : 2}
                                  key={player?.user}>
                                {/* 条件に応じて<Link>を出力 */}
                                {isActive || isCheckPoint ? (
                                    cellContent
                                ) : (
                                    <Link
                                        href={`/compare/${user?.id}/0/1/${currentYear()}/${player?.user}/0/1/${currentYear()}`}
                                    >
                                        {cellContent}
                                    </Link>
                                )}
                            </Grid>
                        );
                    })
                }
                </Grid>
                <Box className="top-box-caption" style={{paddingTop:"1.5em"}}>カテゴリ別総合点 / 投稿数</Box>
                <Grid container>
                {
                    Object.keys(data.data.scores).map((series) =>
                        <Grid item xs={4} sm={3} md={2} key={series}>
                            <Link href={`/total/${series}`}>
                                <CellBox className="cell-box">
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
                                    <CellBox className="cell-box" onClick={handleTooltipOpen} style={{cursor: "pointer"}}>
                                        <br/>
                                        その他<br/>
                                    </CellBox>
                                </Tooltip>
                            </Grid>
                        </ClickAwayListener>
                    )
                }
            </Grid>
            </TopBoxContent>
        </>
    )
}