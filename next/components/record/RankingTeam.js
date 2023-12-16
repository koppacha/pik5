import {dateFormat, fetcher, useLocale} from "../../lib/pik5";
import useSWR from "swr";
import NowLoading from "../NowLoading";
import React, {useState} from 'react'
import {Grid, Typography} from "@mui/material";
import {CompareType, ScoreTail, ScoreType, UserType} from "../../styles/pik5.css";
import Score from "./Score";
import RecordForm from "../modal/RecordForm";
import Button from "@mui/material/Button";
import ModalKeyword from "../modal/ModalKeyword";
import Link from "next/link";

export default function RankingTeam({stage, users, team}){

    const {t} = useLocale()
    const { data:posts } = useSWR(`/api/server/record/${stage}`, fetcher, { refreshInterval: 1000 })

    const teamNumbers = [21, 22]

    const [showAll, setShowAll] = useState(false)
    const [open, setOpen] = useState(false)
    const [keywordOpen, setKeywordOpen] = useState(false)

    const handleClickOpen = () => {
        setOpen(true)
    }
    const handleClose = () => {
        setOpen(false)
    }
    const handleKeywordOpen = () => {
        setKeywordOpen(true)
    }
    const handleKeywordClose = () => {
        setKeywordOpen(false)
    }
    // ２番手以降の表示トグルボタン
    function ToggleButton({ onClick, showAll }) {
        return (
            <button onClick={onClick}>
                {showAll ? '↑２番手以降を隠す' : '↓２番手以降を表示'}
            </button>
        );
    }
    // ステージタイトルは開き括弧より前とそれ以降でブロックを分ける
    const StageComponent = ({ stage }) => {
        const parts = stage.split(/(\(|（)/)
        const beforeBrace = parts[0]
        const afterBrace = parts.slice(1).join('')

        return (
            <>
                {beforeBrace}
                <br/>
                {afterBrace}
            </>
        )
    }
    if(!posts){
        return <NowLoading/>
    }
    // 取得したデータにPrismaから取ってきたスクリーンネームを入れる TODO: あとで共通化
    const data = posts.data ? Object.values(posts.data).map(function(post){
        const user = users.find(user => user.userId === post.user_id)
        return {
            ...post,
            user_name: user ? user.name : ""
        }
    }) : []

    // チーム対抗戦用にデータを加工する
    function processRecords(jsonData) {
        const teams = {};

        // チームごとに記録をまとめる
        Object.values(jsonData).forEach((record) => {
            const teamNumber = team[21].includes(record.user_id) ? 21 : team[22].includes(record.user_id) ? 22 : 0;

            if (!teams[teamNumber]) {
                teams[teamNumber] = [];
            }

            teams[teamNumber].push(record);
        });

        // チームごとにrpsとscoreの合計点を算出
        const teamSummaries = {};

        Object.entries(teams).forEach(([teamNumber, records]) => {
            const rps = records.reduce((sum, record) => sum + record.rps, 0);
            const score = records.reduce((sum, record) => sum + record.score, 0);

            teamSummaries[teamNumber] = {
                rps,
                score,
            };
        });

        return { teams, teamSummaries };
    }
    const { teams, teamSummaries } = processRecords(data);

    const obj = Object.values(teams).map(function(team, index) {
        return (
            <React.Fragment key={index}>
                {t.limited.team[teamNumbers[index]]}:{teamSummaries[teamNumbers[index]]?.rps}<br/>
                {
                    Object.values(team).map(function(record) {
                        return (<div>{`${record.user_name}:${record.rps}`}</div>)
                    })
                }
            </React.Fragment>
        )
    })
    // 各チームの記録を表示
    function TeamRecords({records, showAll}){

        if(!records) return <></>

        return Object.values(records).map(function(record, index){
            const date = new Date(record.created_at ?? "2006-09-01 00:00:00")

            // 2 番目以降で、かつ showAll が false の場合は非表示
            if (index > 0 && !showAll) {
                return null;
            }
            return (
                <div style={{marginBottom:"1em"}} key={index}>
                    <UserType>{record.user_name}</UserType>
                    <Score rule={231216} score={record.score} stage={record.stage_id} category={record?.category} />
                    <CompareType as="span"> (+{record.rps})</CompareType><br/>
                    <Typography style={{color:"#ccc",fontSize:"0.8em"}}>{record.post_comment}（<time dateTime={date.toISOString()}>{dateFormat(date)}</time>）</Typography>
                </div>
            )
        })
    }
    return (
        <>
            <Grid container style={{width:"100%",border:"1px solid #000"}}>
                <Grid item xs={5} style={{textAlign:"right",padding:"0.5em"}}>
                    <TeamRecords records={teams[21]} showAll={showAll} />
                </Grid>
                <Grid item xs={2} style={{textAlign: "center",backgroundColor:"#666",borderLeft:"10px solid #555",borderRight:"10px solid #555",padding:"0.5em"}}>
                    <Link href={"/stage/"+stage}>
                        #{stage}<br/>
                        <StageComponent stage={t.stage[stage]} /><br/>
                    </Link>
                    {teamSummaries[21]?.rps ?? 0} - {teamSummaries[22]?.rps ?? 0}<br/>
                    <ToggleButton onClick={() => setShowAll(!showAll)} showAll={showAll} />
                    <Button onClick={handleKeywordOpen}>ルールを確認</Button>

                </Grid>
                <Grid item xs={5} style={{padding:"0.5em"}}>
                    <TeamRecords records={teams[22]} showAll={showAll} />
                </Grid>
            </Grid>
            <ModalKeyword open={keywordOpen} uniqueId={stage} handleClose={handleKeywordClose} />
        </>
    )
}