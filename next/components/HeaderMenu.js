import {
    AppBar,
    Badge,
    Box, Button, Container,
    IconButton, InputBase,
    Menu,
    MenuItem,
    Slide,
    Toolbar,
    Typography,
    useScrollTrigger
} from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import Link from "next/link";
import MailIcon from "@mui/icons-material/Mail";
import NotificationsIcon from "@mui/icons-material/Notifications";
import {AccountCircle} from "@mui/icons-material";
import MoreIcon from "@mui/icons-material/MoreVert";
import * as React from "react";
import PropTypes from "prop-types";
import {alpha, styled} from "@mui/material/styles";
import ChatBubbleIcon from '@mui/icons-material/ChatBubble';
import {FontAwesomeIcon} from "@fortawesome/react-fontawesome";
import { faDiscord } from '@fortawesome/free-brands-svg-icons'
import {useRouter} from "next/router";
import {en} from "@/locale/en";
import {ja} from "@/locale/ja";
import CustomMenu from "@/components/CustomMenu";

function HideOnScroll(props) {
    const { children, window } = props;
    const trigger = useScrollTrigger({
        target: window ? window() : undefined,
    });

    return (
        <Slide appear={false} direction="down" in={!trigger}>
            {children}
        </Slide>
    );
}
const ThinAppBar = styled(AppBar)(() => ({
    backgroundColor: `#111`,
}));

HideOnScroll.propTypes = {
    children: PropTypes.element.isRequired,
    /**
     * Injected by the documentation to work in an iframe.
     * You won't need it on your project.
     */
    window: PropTypes.func,
};
const Search = styled('div')(({ theme }) => ({
    position: 'relative',
    borderRadius: theme.shape.borderRadius,
    backgroundColor: alpha(theme.palette.common.white, 0.15),
    '&:hover': {
        backgroundColor: alpha(theme.palette.common.white, 0.25),
    },
    marginRight: theme.spacing(2),
    marginLeft: 0,
    width: '100%',
    [theme.breakpoints.up('sm')]: {
        marginLeft: theme.spacing(3),
        width: 'auto',
    },
}));

const SearchIconWrapper = styled('div')(({ theme }) => ({
    padding: theme.spacing(0, 2),
    height: '100%',
    position: 'absolute',
    pointerEvents: 'none',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
}));

const StyledInputBase = styled(InputBase)(({ theme }) => ({
    color: 'inherit',
    '& .MuiInputBase-input': {
        padding: theme.spacing(1, 1, 1, 0),
        // vertical padding + font size from searchIcon
        paddingLeft: `calc(1em + ${theme.spacing(4)})`,
        transition: theme.transitions.create('width'),
        width: '100%',
        [theme.breakpoints.up('md')]: {
            width: '20ch',
        },
    },
}));
export default function HeaderMenu({props}){
    const [anchorEl, setAnchorEl] = React.useState(null);
    const [mobileMoreAnchorEl, setMobileMoreAnchorEl] = React.useState(null);

    // const isMenuOpen = Boolean(anchorEl);
    const isMobileMenuOpen = Boolean(mobileMoreAnchorEl);

    const { locale } = useRouter();
    const t = (locale === "en") ? en : ja;

    const handleProfileMenuOpen = (event) => {
        // setAnchorEl(event.currentTarget);
    };

    const handleMobileMenuClose = () => {
        setMobileMoreAnchorEl(null);
    };

    const handleMenuClose = () => {
        setAnchorEl(null);
        handleMobileMenuClose();
    };

    const handleMobileMenuOpen = (event) => {
        setMobileMoreAnchorEl(event.currentTarget);
    };

    const menuId = 'primary-search-account-menu';

    const renderMenu = (
        <Menu
            anchorEl={anchorEl}
            anchorOrigin={{
                vertical: 'top',
                horizontal: 'right',
            }}
            id={menuId}
            keepMounted
            transformOrigin={{
                vertical: 'top',
                horizontal: 'right',
            }}
            // open={open}
            onClose={handleMenuClose}
        >
            <MenuItem onClick={handleMenuClose}>Profile</MenuItem>
            <MenuItem onClick={handleMenuClose}>My account</MenuItem>
        </Menu>
    );

    const mobileMenuId = 'primary-search-account-menu-mobile';

    const renderMobileMenu = (
        <Menu
            anchorEl={mobileMoreAnchorEl}
            anchorOrigin={{
                vertical: 'top',
                horizontal: 'right',
            }}
            id={mobileMenuId}
            keepMounted
            transformOrigin={{
                vertical: 'top',
                horizontal: 'right',
            }}
            open={isMobileMenuOpen}
            onClose={handleMobileMenuClose}
        >
            <MenuItem>
                <IconButton size="large" aria-label="show 4 new mails" color="inherit">
                    <Badge badgeContent={4} color="error">
                        <MailIcon />
                    </Badge>
                </IconButton>
                <p>Messages</p>
            </MenuItem>
            <MenuItem>
                <IconButton
                    size="large"
                    aria-label="show 17 new notifications"
                    color="inherit"
                >
                    <Badge badgeContent={17} color="error">
                        <NotificationsIcon />
                    </Badge>
                </IconButton>
                <p>Notifications</p>
            </MenuItem>
            <MenuItem onClick={handleProfileMenuOpen}>
                <IconButton
                    size="large"
                    aria-label="account of current user"
                    aria-controls="primary-search-account-menu"
                    aria-haspopup="true"
                    color="inherit"
                >
                    <AccountCircle />
                </IconButton>
                <p>Profile</p>
            </MenuItem>
        </Menu>
    );
    return (
    <HideOnScroll {...props}>
        <div>
            <ThinAppBar>
                <Toolbar>
                    <Typography variant="h6" component="div">
                        <Link href="/">{t.title[0]}</Link>
                    </Typography>
                    {/*<Search>*/}
                    {/*    <SearchIconWrapper>*/}
                    {/*        <SearchIcon />*/}
                    {/*    </SearchIconWrapper>*/}
                    {/*    <StyledInputBase*/}
                    {/*        placeholder="Search???"*/}
                    {/*        inputProps={{ 'aria-label': 'search' }}*/}
                    {/*    />*/}
                    {/*</Search>*/}
                    <CustomMenu series={6}/>
                    <CustomMenu series={1}/>
                    <CustomMenu series={2}/>
                    <CustomMenu series={3}/>
                    <CustomMenu series={4}/>
                    <CustomMenu series={7}/>
                    <CustomMenu series={8}/>
                    <CustomMenu series={9}/>

                    {/*?????????????????????*/}
                    <Box sx={{ flexGrow: 1 }} />
                    <Box sx={{ display: { xs: 'none', md: 'flex' } }}>
                        {/*<IconButton size="middle" aria-label="show 4 new mails" color="inherit">*/}
                        {/*    <FontAwesomeIcon icon={faDiscord} />*/}
                        {/*</IconButton>*/}
                        {/*<IconButton size="large" aria-label="show 4 new mails" color="inherit">*/}
                        {/*    <Badge badgeContent={4} color="error">*/}
                        {/*        <MailIcon />*/}
                        {/*    </Badge>*/}
                        {/*</IconButton>*/}
                        {/*<IconButton*/}
                        {/*    size="large"*/}
                        {/*    aria-label="show 17 new notifications"*/}
                        {/*    color="inherit"*/}
                        {/*>*/}
                        {/*    <Badge badgeContent={17} color="error">*/}
                        {/*        <NotificationsIcon />*/}
                        {/*    </Badge>*/}
                        {/*</IconButton>*/}
                        <CustomMenu series={10}/>
                    </Box>
                    <Box sx={{ display: { xs: 'flex', md: 'none' } }}>
                        <IconButton
                            size="large"
                            aria-label="show more"
                            aria-controls={mobileMenuId}
                            aria-haspopup="true"
                            onClick={handleMobileMenuOpen}
                            color="inherit"
                        >
                            <MoreIcon />
                        </IconButton>
                    </Box>
                </Toolbar>
            </ThinAppBar>
            {renderMobileMenu}
            {renderMenu}
        </div>
    </HideOnScroll>
    )
}