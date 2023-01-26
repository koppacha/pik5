import Link from "next/link";
import {AppBar, Button, Container, Slide, Toolbar, Typography, useScrollTrigger} from "@mui/material";
import styled from "@emotion/styled";
import PropTypes from "prop-types";

// emotionでMUIのデザインをオーバーラップするサンプル
const TextButton = styled(Button)`
  text-transform: none;
`

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

HideOnScroll.propTypes = {
    children: PropTypes.element.isRequired,
    /**
     * Injected by the documentation to work in an iframe.
     * You won't need it on your project.
     */
    window: PropTypes.func,
};

export default function Layout({children, props}) {
    return (
        <>
            <HideOnScroll {...props}>
                <AppBar>
                    <Toolbar>
                        <Typography variant="h6" component="div">
                            Scroll to hide App bar
                        </Typography>
                    </Toolbar>
                </AppBar>
            </HideOnScroll>
            <Toolbar />
            <Container maxWidth="lg">
                ピクチャレ大会（仮）<br/>
                <TextButton>テスト</TextButton>
                <ul>
                    <li><Link href="/">Home</Link></li>
                    <li><Link href="/login">Login</Link></li>
                    <li><Link href="/register">Register</Link></li>
                    <li><Link href="/stage/201">こてしらべの洞窟</Link></li>
                    <li><Link href="/stage/202">新参者の試練場</Link></li>
                    <li><Link href="/stage/203">神々のおもちゃ箱</Link></li>
                </ul>
                <br/>
                <main>{children}</main>
            </Container>
        </>
    )
}
