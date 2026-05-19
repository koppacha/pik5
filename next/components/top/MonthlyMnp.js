import useSWR from "swr"
import {fetcher, id2name} from "../../lib/pik5"
import NowLoading from "../NowLoading"
import {CellBox} from "../../styles/pik5.css"
import {Grid} from "@mui/material"
import Link from "next/link"

export default function MonthlyMnp({users}) {
    const {data} = useSWR("/api/server/user/monthly-mnp", fetcher)
    const mvp = data?.data ?? []

    if (!data) {
        return (
            <Grid container>
                <Grid item xs={12} sm={6} md={4}>
                    <CellBox>
                        <NowLoading />
                    </CellBox>
                </Grid>
            </Grid>
        )
    }

    if (!mvp.length) {
        return (
            <Grid container>
                {Array.from({length: 12}).map((_, index) => (
                    <Grid item xs={4} sm={3} md={2} key={index}>
                        <CellBox className="cell-box">月次データがありません</CellBox>
                    </Grid>
                ))}
            </Grid>
        )
    }

    return (
        <Grid container>
            {mvp.map((item, index) => (
                <Grid item key={`${item.year}-${item.month}-${index}`} xs={4} sm={3} md={2} component={Link} href={`/user/${item.user}`}>
                    <CellBox className="cell-box">
                        <span className="cell-box-caption">{item.label || `${item.year}/${String(item.month).padStart(2, "0")}`}</span><br/>
                        {id2name(users, item.user)}<br/>
                        <span className="cell-box-caption">
                            +{Number(item.delta).toLocaleString()} rps.
                        </span>
                    </CellBox>
                </Grid>
            ))}
        </Grid>
    )
}
