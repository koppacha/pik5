import {FontAwesomeIcon} from "@fortawesome/react-fontawesome";
import {faCircleNotch} from "@fortawesome/free-solid-svg-icons";
import {Typography} from "@mui/material";
import * as React from "react";

export default function NowLoading(){
    return (
        <Typography>
            <FontAwesomeIcon style={{fontSize:"1.2em", marginRight:"0.5em"}} icon={faCircleNotch} spin />
        </Typography>
    )
}