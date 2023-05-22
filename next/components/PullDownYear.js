import {FormControl, FormHelperText, MenuItem, Select} from "@mui/material";
import Link from "next/link";
import * as React from "react";
import {range} from "../plugin/pik5";

export default function PullDownYear(props){

    const now = new Date()
    const years = range(2014, now.getFullYear()).reverse()

    return (
        <FormControl>
            <FormHelperText sx={{color:"#fff"}}>集計年</FormHelperText>
            <Select
                sx={{color:'#fff'}}
                defaultValue={props.year}
                id="select-year"
            >
                {
                    // 集計年プルダウンを出力
                    years.map(val =>
                        <MenuItem value={val} component={Link} href={'/stage/'+props.stage+'/'+
                            props.console+'/'+props.rule+'/'+val}>{val}</MenuItem>
                    )
                }
            </Select>
        </FormControl>
    )
}