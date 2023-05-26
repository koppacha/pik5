import {FormControl, FormHelperText, MenuItem, Select} from "@mui/material";
import Link from "next/link";
import * as React from "react";
import {range} from "../plugin/pik5";
import {styled} from "@mui/material/styles";

export default function PullDownYear(props){

    const StyledSelect = styled(Select)`
      color: #fff;
      border: 1px solid #fff;
      & > svg {
        color: #fff;
      }
    `

    const now = new Date()
    const years = range(2014, now.getFullYear()).reverse()

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
                        <MenuItem value={val} component={Link} href={'/stage/'+props.stage+'/'+
                            props.console+'/'+props.rule+'/'+val}>{val}</MenuItem>
                    )
                }
            </StyledSelect>
        </FormControl>
    )
}