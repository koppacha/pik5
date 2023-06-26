import {useLocale} from "../../lib/pik5";
import {FormControl, FormHelperText, MenuItem} from "@mui/material";
import {StyledSelect} from "../../styles/pik5.css";
import Link from "next/link";
import * as React from "react";

export default function SpeedRunConsole({stage, console, consoles}){

    const {t} = useLocale()

    if(!consoles){
        return (
            <></>
        )
    }
    return (
        <FormControl>
            <FormHelperText className="form-helper-text">{t.speedrun.console.title}</FormHelperText>
            <StyledSelect
                defaultValue={console}
                id="select-console"
            >
                {
                    consoles.map(val =>
                        (
                            <MenuItem value={val} component={Link} href={'/speedrun/'+stage+'/'+val}>{t.speedrun.console[val]}</MenuItem>
                        )
                    )
                }
            </StyledSelect>
        </FormControl>
    )
}