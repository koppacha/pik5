import {useRouter} from "next/router";
import {en} from "../../locale/en";
import {ja} from "../../locale/ja";
import {AppBar, Box, Container, FormControl, Grid, MenuItem, Select, Typography} from "@mui/material";
import Link from "next/link";
import Record from "../../components/Record";

export async function getServerSideProps(context){
    const query = context.query.series
    const series = query[0]
    const rule  = query[2] || 10
    const console = query[1] || 0
    const year  = query[3] || 2023

    // シリーズ番号に基づいて集計対象ステージをバックエンドで選別して持ってくる
    const res = await fetch(`http://laravel:8000/api/total/${series}/${console}/${rule}/${year}`)
    const data = await res.json()

    return {
        props: {
            data, series, rule, console, year
        }
    }
}

export default function Series(param){

    const { locale } = useRouter();
    const t = (locale === "en") ? en : ja;

    const stages = param.data['stage_list'];
    const records = param.data.data;
    const rules = [10, 11, 12, 13, 14, 15, 16, 17]
    const consoles = [0, 1, 2, 3, 4]
    const years = [2023, 2022, 2021, 2020, 2019, 2018, 2017, 2016, 2015, 2014]

    return (
        <>
            総合ランキング<br/>
            #{param.series}<br/>
            <Typography variant="h3">{ t.stage[param.series.slice(0,2)] }</Typography>
            <Grid container>
                {
                    stages.map(stage =>
                    <Grid xs={1.5}>
                        <Link href={'/stage/'+stage}><Box sx={{
                            border: 'solid 1px #fff',
                            borderRadius: '6px',
                            padding: '8px',
                            margin: '4px',
                            minHeight: '6em',
                            fontSize: '0.8em'}}>
                            <span>#{stage}</span><br/>
                            {t.stage[stage]}</Box>
                        </Link>
                    </Grid>
                    )
                }
            </Grid>
            ルール
            <FormControl>
                <Select
                    sx={{color:'#fff'}}
                    defaultValue={param.rule}
                    id="select-rules"
                >
                    {
                        // ルールプルダウンを出力
                        rules.map(val =>
                            <MenuItem value={val}><Link href={'/total/'+param.series+'/'+
                                param.console+'/'+val+'/'+param.year}>{t.rule[val]}</Link></MenuItem>
                        )
                    }
                </Select>
            </FormControl>

            操作方法
            <FormControl>
                <Select
                    sx={{color:'#fff'}}
                    defaultValue={param.console}
                    id="select-consoles"
                >
                    {
                        // 操作方法プルダウンを出力
                        consoles.map(val =>
                            <MenuItem value={val}><Link href={'/total/'+param.series+'/'+
                                val+'/'+param.rule+'/'+param.year}>{t.console[val]}</Link></MenuItem>
                        )
                    }
                </Select>
            </FormControl>
            集計年
            <FormControl>
                <Select
                    sx={{color:'#fff'}}
                    defaultValue={2023}
                    id="select-year"
                >
                    {
                        // 集計年プルダウンを出力
                        years.map(val =>
                            <MenuItem value={val}><Link href={'/total/'+param.series+'/'+
                                param.console+'/'+param.rule+'/'+val}>{val}</Link></MenuItem>
                        )
                    }
                </Select>
            </FormControl>
            <ul>
                {
                    Object.keys(records).map(e =>
                        <Record data={records[e]} />
                    )
                }
            </ul>
        </>
    )
}