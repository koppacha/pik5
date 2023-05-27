import {FormControl, FormHelperText, MenuItem, Select} from "@mui/material";
import Link from "next/link";
import * as React from "react";
import {range} from "../plugin/pik5";
import {StyledSelect} from "../styles/pik5.css";

export default function PullDownYear(props){

    const now = new Date()
    const years = range(2014, now.getFullYear()).reverse()

    let type = ""
    let id   = ""

    if(props.info){
        type = props.info.type
        id   = props.info.stage_id
    } else {
        type = "user"
        id   = props.user
    }

    return (
        <FormControl sx={{ marginLeft: 3}}>
            <FormHelperText sx={{color:"#fff"}}>集計年</FormHelperText>
            <StyledSelect
                defaultValue={props.year}
                id="select-year"
            >
                {
                    // 集計年プルダウンを出力
                    years.map(val =>
                        <MenuItem value={val} component={Link} href={'/'+type+'/'+id+'/'+
                            props.console+'/'+props.rule+'/'+val}>{val}</MenuItem>
                    )
                }
            </StyledSelect>
        </FormControl>
    )
}