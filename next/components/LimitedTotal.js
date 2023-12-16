import {Grid} from "@mui/material";
import * as React from "react";
import {fetcher, id2name} from "../lib/pik5";
import useSWR from "swr";

export default function LimitedTotal({}){

    const limited = 231216

    // 対象ステージの記録をリクエスト
    const {data:total} = useSWR(`/api/server/total/${limited}`,fetcher, { refreshInterval: 1000 })

    // 投票データベースから各ユーザーのチーム情報をリクエスト
    const {data:team} = useSWR(`/api/server/vote/20${limited}`,fetcher, { refreshInterval: 1000 })

    // チーム情報を整形する
    const teams = team.reduce((acc, obj) => {
        const key = obj.select?.toString();
        if (!acc[key]) {
            acc[key] = [];
        }
        acc[key].push(obj?.user);
        return acc;
    }, {});

    const teamColor = ['#58c4c1', '#bbc458']

    function TeamMemberPoints({team}){
        if(!teams[team]) return <></>

        return teams[team].map(function(user){
            const count = total[user]?.ranks.filter(v => v !== null).length ?? 0
            const rps = rpsBonus(count, total[user]?.rps ?? 0)
            return <><Grid item xs={6}>{id2name(users, user)}</Grid><Grid item xs={6}>{rps} RPS [{count} Stage]</Grid></>
        })
    }
    function rpsBonus(count, rps){
        if(count === 1) rps = Math.floor(rps * 1.6)
        if(count === 2) rps = Math.floor(rps * 1.2)
        if(count >   4) rps = Math.floor(rps * 0.8)
        return rps
    }
    function teamTotalRps(team){
        if(!param.teams[team]) return 0


        let rpss = 0
        param.teams[team].map(function(user){

            // 各プレイヤーの投稿数を調べて補正係数を適用
            const rps = rpsBonus(param.total[user]?.ranks.filter(v => v !== null).length, param.total[user]?.rps ?? 0)

            // チーム別ランクポイントに加算
            rpss += rps
        })
        return rpss
    }

    return (
        <Grid container alignItems="flex-start" style={{marginTop:"1em"}}>
            <Grid container alignItems="flex-start" item xs={12} md={6}>
                <div style={{width:"98%",color:"#333",textAlign:"center",padding:"8px",borderRadius:"4px",backgroundColor:teamColor[0]}}>
                    チーム氷ピクミン
                </div>
                <Grid item xs={6}>
                    <span style={{fontSize:"1000%",fontFamily:"Proza Libre",letterSpacing:"-0.1em",color:teamColor[0]}}>{teamTotalRps(21)}</span>
                </Grid>
                <Grid container item xs={6} style={{paddingTop:"1em",paddingBottom:"1em",paddingRight:"1em",textAlign:"right"}}>
                    <TeamMemberPoints team={21}/>
                </Grid>
            </Grid>
            <Grid container alignItems="flex-start" item xs={12} md={6}>
                <div style={{width:"98%",color:"#333",textAlign:"center",padding:"8px",borderRadius:"4px",backgroundColor:teamColor[1]}}>
                    チームヒカリピクミン
                </div>
                <Grid container item xs={6} style={{paddingTop:"1em",paddingBottom:"1em"}}>
                    <TeamMemberPoints team={22}/>
                </Grid>
                <Grid item xs={6} style={{textAlign:"right"}}>
                    <span style={{fontSize:"1000%",fontFamily:"Proza Libre",letterSpacing:"-0.1em",color:teamColor[1]}}>{teamTotalRps(22)}</span>
                </Grid>
            </Grid>
        </Grid>
    )
}