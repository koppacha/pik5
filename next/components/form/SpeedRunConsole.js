import {useLocale} from "../../lib/pik5";
import {FormControl, FormHelperText, MenuItem} from "@mui/material";
import {StyledSelect} from "../../styles/pik5.css";
import Link from "next/link";
import * as React from "react";

export default function SpeedRunConsole({stage, console:cnsl, consoles}){

    const {t} = useLocale()

    if(!consoles || consoles.length === 0){
        return (
            <></>
        )
    }
    return (
        <FormControl>
            <FormHelperText className="form-helper-text">{t.speedrun.console.title}</FormHelperText>
            <StyledSelect
                className="styled-select"
                defaultValue={consoles[0]}
                value={cnsl || consoles[0]}
                id="select-console"
            >
                {
                    consoles.map(val =>
                        (
                            <MenuItem key={val} value={val} component={Link} href={'/speedrun/'+stage+'/'+val}>{t.speedrun.console[val]}</MenuItem>
                        )
                    )
                }
            </StyledSelect>
        </FormControl>
    )
}
