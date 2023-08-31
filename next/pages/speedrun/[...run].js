import Record from "../../components/record/Record";
import useSWR from "swr";
import NowLoading from "../../components/NowLoading";
import {fetcher, useLocale} from "../../lib/pik5";
import BreadCrumb from "../../components/BreadCrumb";
import * as React from "react";
import {FormControl, FormHelperText, Grid, MenuItem, Typography} from "@mui/material";
import {RuleBox, StairIcon, StyledSelect} from "../../styles/pik5.css";
import Link from "next/link";
import SpeedRunWrapper from "../../components/record/SpeedRunWrapper";
import SpeedRunRules from "../../components/form/SpeedRunRules";
import SpeedRunConsole from "../../components/form/SpeedRunConsole";
import {FontAwesomeIcon} from "@fortawesome/react-fontawesome";
import {faHouseChimney, faStairs} from "@fortawesome/free-solid-svg-icons";
import Head from "next/head";

export async function getServerSideProps(context){

    const query = context.query.run
    const stage = query[0]
    const console = query[1] || 0

    let q = ""
    const consoles = [0]

    switch(Number(stage)){
        case 101:
            q += "m1zyjx60/category/9kv9y02g"
            consoles.push(1, 2)
            switch (Number(console)){
                case 1:
                    q += "?var-onv29rml=klr0dpjl"
                    break
                case 2:
                    q += "?var-onv29rml=21dynz41"
                    break
            }
            break
        case 102:
            q += "m1zyjx60/category/zd3g682n"
            consoles.push(5, 6)
            switch (Number(console)){
                case 1:
                    q += "?var-jlz6mx82=9qj74p3q"
                    break
                case 2:
                    q += "?var-jlz6mx82=jq65x8jl"
                    break
            }
            break
        case 201:
            consoles.push(1, 2)
            switch (Number(console)){
                case 1:
                    q += "pdv9zv1w/category/zd3x7ndn"
                    break
                case 2:
                    q += "yd4k0ep6/category/7kjg7e3k"
                    break
                default:
                    q += "pdv9zv1w/category/zd3x7ndn"
                    break
            }
            break
        case 202:
            consoles.push(1, 2)
            switch (Number(console)){
                case 1:
                    q += "pdv9zv1w/category/wdmggxdq"
                    break
                case 2:
                    q += "yd4k0ep6/category/xk9w94v2"
                    break
                default:
                    q += "pdv9zv1w/category/wdmggxdq"
                    break
            }
            break
        case 203:
            q += "pdv9zv1w/category/jdrw35xk?var-ylqomdm8=9qj3noel"
            break
        case 204:
            q += "pdv9zv1w/category/jdrw35xk?var-ylqomdm8=jq6drw31"
            break
        case 301:
            consoles.push(3, 4)
            switch (Number(console)){
                case 3:
                    q += "nd27e310/category/rklrvwkn"
                    break
                case 4:
                    q += "76rxq246/category/jdzw1xgd"
                    break
                default:
                    q += "nd27e310/category/rklrvwkn"
                    break
            }
            break
        case 302:
            consoles.push(3, 4)
            switch (Number(console)){
                case 3:
                    q += "nd27e310/category/9d8gjv7k"
                    break
                case 4:
                    q += "76rxq246/category/02qvy6yd"
                    break
                default:
                    q += "nd27e310/category/9d8gjv7k"
                    break
            }
            break
        case 303:
            consoles.push(3, 4)
            switch (Number(console)){
                case 3:
                    q += "nd27e310/category/ndx47j2q"
                    break
                case 4:
                    q += "76rxq246/category/82405zwd"
                    break
                default:
                    q += "nd27e310/category/ndx47j2q"
                    break
            }
            break
        case 311:
            q += "268e3x56/category/z276730d"
            break
        case 312:
            q += "268e3x56/category/5dw845nd"
            break
        case 313:
            q += "268e3x56/category/ndx9rovd"
            break
        case 401:
            q += "m1zk9901/category/rkl8xe62"
            break
        case 402:
            q += "m1zk9901/category/wk6gn0od"
            break
        case 403:
            q += "m1zk9901/category/zd3mxpv2"
            break
        case 404:
            q += "m1zk9901/category/n2y6oe7d"
            break
        case 405:
            q += "m1zk9901/category/n2y69pmd"
            break



    }
    // ステージ情報をリクエスト
    const res = await fetch(`https://www.speedrun.com/api/v1/leaderboards/${q}`)
    const data = await res.json()

    if(!data){
        return {
            notFound: true,
        }
    }

    return {
        props: {
            data, stage, console, consoles
        }
    }
}

export default function Run({data, stage, console, consoles}){

    const {t, r} = useLocale()

    const dates = data.data.runs

    return (
        <>
            <Head>
                <title>{t.speedrun[stage]+" - "+t.title[0]}</title>
            </Head>
            <Link href="/"><FontAwesomeIcon icon={faHouseChimney}/></Link>
            <StairIcon icon={faStairs}/>
            <Link href="https://www.speedrun.com/pikmin">{t.speedrun.title}</Link>
            <StairIcon icon={faStairs}/>
            {t.title[stage.slice(0,2) === "31"?31:stage.slice(0,1)]}<br/>
            #S{stage}<br/>
            <Typography variant="" className="title">{ t.speedrun[stage] }</Typography><br/>
            <Typography variant="" className="subtitle">{r.speedrun[stage]}</Typography><br/>
            <SpeedRunConsole stage={stage} console={console} consoles={consoles}/>
            <Grid item style={{
                marginTop:"20px",marginBottom:"20px"
            }}>
                <SpeedRunRules stage={stage} console={console}/>
            </Grid>
            {
                dates.map(function (post, index){
                        return (
                            <SpeedRunWrapper key={index} post={post} index={index} />
                        )
                    }
                )
            }
        </>
    )
}