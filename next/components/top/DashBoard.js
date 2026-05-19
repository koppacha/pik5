import React, {useState} from "react";
import useSWR from "swr";
import {currentYear, fetcher, id2name, rankColor, useLocale} from "../../lib/pik5";
import NowLoading from "../NowLoading";
import {Box, ClickAwayListener, Grid, Tooltip} from "@mui/material";
import {CellBox, EventContainer, EventContent, SeriesTheme, TopBoxContent, TopBoxHeader} from "../../styles/pik5.css";
import {basePoints, rule2array, selectable, stageCounts} from "../../lib/const";
import Link from "next/link";
import {FontAwesomeIcon} from "@fortawesome/react-fontawesome";
import {faCircleInfo, faCircleQuestion, faFlag, faRankingStar, faStar} from "@fortawesome/free-solid-svg-icons";
import GradientLine from "./GradientLine";
import RankPointHistoryChart from "./RankPointHistoryChart";

export default function DashBoard({user, users, simple = false}){

    const {t, locale} = useLocale()
    const [open, setOpen] = useState(false)

    const {data} = useSWR(`/api/server/user/total/${user?.id}`, fetcher)
    const {data:totalRanking} = useSWR(`/api/server/user/rank/0`, fetcher)
    const {data:rpsHistory} = useSWR(simple ? `/api/server/user/rps-history/${user?.id}/0` : null, fetcher)

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
    // 取得した合計ランクポイントを正規化し、非数だった場合は0に置き換える
    const normalizedRps = Number(data.data?.totals?.rps)
    const totalRps = Number.isFinite(normalizedRps) ? normalizedRps : 0

    // 最新のステージ数を取得
    const stageCnt = stageCounts[currentYear()]

    const cls = basePoints.findLastIndex(base => totalRps > stageCnt * base)
    const clas = (rps) => basePoints.findLastIndex(base => rps >= stageCnt * base)
    const nextPoints = (basePoints[cls + 1] * stageCnt) - totalRps
    const notPostCategory = selectable.filter(value => !Object.keys(data.data?.scores ?? {}).map(Number).includes(value))

    const rivals = simple
        ? getOwnRanking(totalRanking?.data, user?.id)
        : getSurroundingRanking(totalRanking?.data, user?.id, totalRps, (basePoints[cls + 1] * stageCnt))
    const latestHistory = rpsHistory?.data?.series?.[0]?.items?.filter(item => item.rps !== null).at(-1)
    const rpsDelta = latestHistory?.delta

    // 前後プレイヤー５名を抽出する関数
    function getSurroundingRanking(totalRanking, userId, userRps, checkPoint = 0) {
        const userIndex = totalRanking.findIndex(item => item.user === userId)

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
    function getOwnRanking(totalRanking, userId) {
        return totalRanking?.filter(item => item.user === userId) ?? []
    }
    // その他メニューの開閉制御
    const handleTooltipClose = () => {
        setOpen(false);
    }
    const handleTooltipOpen = () => {
        setOpen(true);
    }
    const categoryGridItemStyle = {display: "flex"}
    const categoryLinkStyle = {display: "flex", flex: 1}
    const categoryCellBoxStyle = {flex: 1}
    const categorySeries = Object.keys(data.data?.scores ?? {})
        .filter(series => !simple || [10, 20, 30, 40].includes(Number(series)))
    const consoleCategoryRules = [10, 20, 30]
    const smallMetaStyle = {fontSize: "0.85em"}
    const rankStarStyle = {color: "var(--color-rank-1-border)"}
    const renderCategoryMeta = ({marks, stageCount, rank = null, participants = null}) => (
        <>
            {marks >= stageCount && <FontAwesomeIcon icon={faStar} style={{color: "#fff"}} />}
            {marks}<span style={smallMetaStyle}>/{stageCount}</span>
            {rank !== null && (
                <>
                    {" - "}
                    {rank ? `${rank}位` : "-位"}<span style={smallMetaStyle}>/{participants ?? "-"}</span>
                    {rank === 1 && <FontAwesomeIcon icon={faStar} style={rankStarStyle} />}
                </>
            )}
        </>
    )
    const categoryMeta = (series) => {
        const marks = data.data.marks?.[series] ?? 0
        const stageCount = rule2array(series).length
        const categoryRank = data.data.categoryRanks?.[series]
        return renderCategoryMeta({
            marks,
            stageCount,
            rank: categoryRank?.rank ?? 0,
            participants: categoryRank?.participants ?? "-"
        })
    }
    const consoleRows = (series) => Object.values(data.data.consoleScores?.[series] ?? {})
        .sort((a, b) => Number(a.console) - Number(b.console))
    const renderCategoryCell = (series, detail = false) => {
        const marks = data.data.marks?.[series] ?? 0
        const stageCount = rule2array(series).length
        return (
            <Link href={`/total/${series}`} style={categoryLinkStyle}>
                <CellBox className="cell-box" style={categoryCellBoxStyle}>
                    <GradientLine baseColor={SeriesTheme(Number(series.at(0)))} />
                    <span className="cell-box-caption">{t.subtitle[series]}</span><br/>
                    {Number(data.data.scores[series]).toLocaleString()} <span className=".score-tail" style={{fontSize:"0.8em"}}>pts.</span><br/>
                    <span className="cell-box-caption">
                        {detail
                            ? categoryMeta(series)
                            : renderCategoryMeta({marks, stageCount})
                        }
                    </span>
                </CellBox>
            </Link>
        )
    }
    const renderConsoleCell = (series, row) => (
        <Link href={`/total/${series}/${row.console}/${series}/${currentYear()}`} style={categoryLinkStyle}>
            <CellBox className="cell-box" style={categoryCellBoxStyle}>
                <GradientLine baseColor={SeriesTheme(Number(series.at(0)))} />
                <span className="cell-box-caption">{t.subtitle[series]} / {t.cnsl?.[row.console] ?? row.console}</span><br/>
                {Number(row.score).toLocaleString()} <span className=".score-tail" style={{fontSize:"0.8em"}}>pts.</span><br/>
                <span className="cell-box-caption">
                    {renderCategoryMeta({
                        marks: row.mark,
                        stageCount: rule2array(series).length,
                        rank: row.rank,
                        participants: row.participants
                    })}
                </span>
            </CellBox>
        </Link>
    )
    return (
        <>
            <Box className={"top-box"}>
                <TopBoxHeader className="top-box-header">
                    <span><FontAwesomeIcon icon={faCircleInfo} />{t.g.dashBoard}</span>
                    {
                        (cls < (basePoints.length - 2)) ?
                            (locale === "ja") ?
                                <span style={{fontSize: "0.8em"}}>{t.classes[cls + 1]} まであと {nextPoints.toLocaleString()} 点</span>
                                :
                                <span style={{fontSize: "0.8em"}}>Points required for {t.classes[cls + 1]}: {nextPoints.toLocaleString()} rps.</span>
                            :
                            <span style={{fontSize: "0.8em"}}>{t.g.maxClass}</span>
                    }
                </TopBoxHeader>
                <TopBoxContent className="top-box-content">
                    {!simple && <Box className="top-box-caption">{t.g.totalAndRival}<Tooltip title={`ランクポイントは投稿ステージの順位に応じてもらえるポイントです。より人気なステージで上位なほど得点が多くもらえます。段位はステージ数に特定の係数を掛けることで算出されるポイントを超えると認定されます。最高段位（九段）に到達したプレイヤーのうち最高点数保持者には「名人」タイトルが授与されます。現在の対象ステージは210ステージです。`}><FontAwesomeIcon icon={faCircleQuestion} /></Tooltip></Box>}
                <Grid container alignItems="stretch">
                    {
                        rivals.map(player => {
                            const isActive = player?.user === user?.id
                            const isCheckPoint = player?.user === "checkPoint"
                            const cellLink = (isActive || isCheckPoint) ? `/user/${user?.id}` : `/compare/${user?.id}/0/1/${currentYear()}/${player?.user}/0/1/${currentYear()}`
                            const deltaText = Number.isFinite(rpsDelta)
                                ? `${rpsDelta > 0 ? "+" : ""}${Number(rpsDelta).toLocaleString()}`
                                : null

                            const cellContent = (
                                <CellBox className={`cell-box ${isActive ? "active" : ""}`}>
                                    {/* 1行目: 順位とクラス */}
                                    <GradientLine rps={player?.rps} rps1={player?.rps1} rps2={player?.rps2} rps3={player?.rps3} rps4={player?.rps4} />
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
                                            {player?.rps < (stageCnt * basePoints.at(-1)) && (
                                                <>{Number(player?.rps).toLocaleString()} rps.</>
                                            )}
                                            {simple && isActive && deltaText && (
                                                <span style={{marginLeft: "0.5em", color: rpsDelta >= 0 ? "#d95c5c" : "#4d79bd"}}>
                                                    ({deltaText})
                                                </span>
                                            )}
                                        </span>
                                </CellBox>
                        );

                        return (
                                <Grid item
                                      xs={4}
                                      lg={isCheckPoint ? 1.5 : isActive ? 2.5 : 2}
                                      key={player?.user}>
                                        <Link href={cellLink}>{cellContent}</Link>
                                </Grid>
                            );
                        })
                    }
                    {simple && categorySeries.map((series) =>
                        <Grid item xs={4} sm={3} md={2} key={series} style={categoryGridItemStyle}>
                            {renderCategoryCell(series)}
                        </Grid>
                    )}
                </Grid>
                    {!simple && <Box className="top-box-caption" style={{paddingTop:"1.5em"}}>{t.g.categoryAndPosts}</Box>}
                    {!simple && <Grid container alignItems="stretch">
                    {
                        categorySeries.map((series) => (
                            <React.Fragment key={series}>
                                <Grid item xs={4} sm={3} md={2} style={categoryGridItemStyle}>
                                    {renderCategoryCell(series, true)}
                                </Grid>
                                {consoleCategoryRules.includes(Number(series)) && consoleRows(series).map(row => (
                                    <Grid item xs={4} sm={3} md={2} key={`${series}-${row.console}`} style={categoryGridItemStyle}>
                                        {renderConsoleCell(series, row)}
                                    </Grid>
                                ))}
                            </React.Fragment>
                        ))
                    }
                    {
                        (notPostCategory.length > 0) && (
                            <ClickAwayListener onClickAway={handleTooltipClose}>
                                <Grid item xs={4} sm={3} md={2} key={0} style={categoryGridItemStyle}>
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
                                        <CellBox className="cell-box" onClick={handleTooltipOpen} style={{...categoryCellBoxStyle, cursor: "pointer"}}>
                                            <GradientLine baseColor={"#ccc"} />
                                            <br/>
                                            {t.title[9]}<br/>
                                        </CellBox>
                                    </Tooltip>
                                </Grid>
                            </ClickAwayListener>
                        )
                    }
                </Grid>}
                </TopBoxContent>
            </Box>
            {!simple &&
                <Box className={"top-box"}>
                    <TopBoxHeader className="top-box-header">
                        <span><FontAwesomeIcon icon={faRankingStar} />ランクポイント推移</span>
                    </TopBoxHeader>
                    <TopBoxContent className="top-box-content">
                        <RankPointHistoryChart user={user} users={users} />
                    </TopBoxContent>
                </Box>
            }
        </>
    )
}
