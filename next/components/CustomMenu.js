import {useState} from "react";
import {Button, Menu, MenuItem} from "@mui/material";
import {useRouter} from "next/router";
import {en} from "@/locale/en";
import {ja} from "@/locale/ja";
import CustomMenuItems from "@/components/CustomMenuItems";

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
                sx={{ color:'#fff',fontSize: '1em' }}
                id="basic-button"
                aria-controls={open ? 'total-menu' : undefined}
                aria-haspopup="true"
                aria-expanded={open ? 'true' : undefined}
                onClick={handleClick}>
                {t.title[props.series]}
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