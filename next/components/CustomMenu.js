import {useState} from "react";
import {Button, Menu, MenuItem} from "@mui/material";
import {useRouter} from "next/router";
import {en} from "@/locale/en";
import {ja} from "@/locale/ja";
import CustomMenuItems from "@/components/CustomMenuItems";
import {AccountCircle} from "@mui/icons-material";
import * as React from "react";

export default function CustomMenu(props){

    // プルダウンメニュー駆動周り
    const [anchorEl, setAnchorEl] = useState(null);
    const open = Boolean(anchorEl);

    const handleClick = (event) => {
        setAnchorEl(event.currentTarget);
    };
    const handleClose = () => {
        setAnchorEl(null);
    };

    const { locale } = useRouter();
    const t = (locale === "en") ? en : ja;

    return (
        <MenuItem>
            <Button
                sx={{
                    color:'#fff',
                    backgroundColor:'#999',
                    fontSize: '0.9em'
            }}
                id="basic-button"
                aria-controls={open ? 'total-menu' : undefined}
                aria-haspopup="true"
                aria-expanded={open ? 'true' : undefined}
                onClick={handleClick}>
                {props.series < 10
                    ? t.title[props.series]
                    : <AccountCircle />
                }
            </Button>
            <Menu
                id="total-menu"
                anchorEl={anchorEl}
                open={open}
                onClose={handleClose}
                MenuListProps={{
                    'aria-labelledby': 'basic-button',
                }}
            >
                <CustomMenuItems series={props.series}/>
            </Menu>
        </MenuItem>
    )
}