import '@/styles/globals.css';
import '@/styles/styles.scss';
import Layout from '../components/Layout';
import '@fortawesome/fontawesome-svg-core/styles.css';
import {ThemeProvider} from "next-themes";
import {SessionProvider} from "next-auth/react";
import {GlobalStyle} from "../styles/pik5.css";
import {useEffect, useState} from "react";
import Script from "next/script";
import {ga, pageView} from "../lib/gtag";
import {useRouter} from "next/router";
import createEmotionCache from "../lib/createEmotionCache";
import {CacheProvider} from "@emotion/react";
import PropTypes from "prop-types";
import * as React from "react";
import {DevSupport} from "@react-buddy/ide-toolbox-next";
import {ComponentPreviews, useInitial} from "../dev";
import SeoHead from "../components/SeoHead"
import {Backdrop, Box, CircularProgress, Typography} from "@mui/material"

const clientSideEmotionCache = createEmotionCache()

export default function App(props) {
    const {Component, emotionCache = clientSideEmotionCache, pageProps: {session, ...pageProps}} = props

    const router = useRouter()
    const [pageLoading, setPageLoading] = useState(false)

    const showUnloadLoadingLayer = () => {
        if (typeof document === "undefined") return
        if (document.getElementById("__reload-loading-backdrop")) return

        if (!document.getElementById("__reload-loading-style")) {
            const style = document.createElement("style")
            style.id = "__reload-loading-style"
            style.textContent = `
              @keyframes reload-loading-spin { to { transform: rotate(360deg); } }
            `
            document.head.appendChild(style)
        }

        const backdrop = document.createElement("div")
        backdrop.id = "__reload-loading-backdrop"
        backdrop.setAttribute("aria-hidden", "true")
        backdrop.style.position = "fixed"
        backdrop.style.inset = "0"
        backdrop.style.display = "flex"
        backdrop.style.alignItems = "center"
        backdrop.style.justifyContent = "center"
        backdrop.style.background = "rgba(0,0,0,0.5)"
        backdrop.style.color = "#fff"
        backdrop.style.zIndex = "1400"

        const box = document.createElement("div")
        box.style.textAlign = "center"

        const spinner = document.createElement("div")
        spinner.style.width = "40px"
        spinner.style.height = "40px"
        spinner.style.margin = "0 auto"
        spinner.style.border = "3px solid rgba(255,255,255,0.25)"
        spinner.style.borderTopColor = "#fff"
        spinner.style.borderRadius = "50%"
        spinner.style.animation = "reload-loading-spin 0.8s linear infinite"

        const text = document.createElement("div")
        text.textContent = "Loading..."
        text.style.marginTop = "12px"

        box.appendChild(spinner)
        box.appendChild(text)
        backdrop.appendChild(box)
        document.body.appendChild(backdrop)
    }

    useEffect(() => {
        const handleStart = (url) => url !== router.asPath && setPageLoading(true)
        const handleComplete = () => setPageLoading(false)
        const handleRouterChange = (url) => {
            pageView(url)
        }
        const handleBeforeUnload = () => {
            showUnloadLoadingLayer()
        }
        router.events.on("routeChangeStart", handleStart)
        router.events.on("routeChangeComplete", handleComplete)
        router.events.on("routeChangeComplete", handleRouterChange)
        router.events.on("routeChangeError", handleComplete)
        window.addEventListener("beforeunload", handleBeforeUnload)
        window.addEventListener("pagehide", handleBeforeUnload)
        return () => {
            router.events.off("routeChangeStart", handleStart)
            router.events.off("routeChangeComplete", handleComplete)
            router.events.off("routeChangeComplete", handleRouterChange)
            router.events.off("routeChangeError", handleComplete)
            window.removeEventListener("beforeunload", handleBeforeUnload)
            window.removeEventListener("pagehide", handleBeforeUnload)
        }
    }, [router.events])

    function Loading() {
        return (
            <Backdrop
                open={true}
                sx={{color: '#fff', zIndex: (theme) => theme.zIndex.modal + 1}}
            >
                <Box style={{textAlign: "center"}}>
                    <CircularProgress color="inherit" />
                    <Typography style={{marginTop: "12px"}}>Loading...</Typography>
                </Box>
            </Backdrop>
        )
    }

    return (
        <>
            <SeoHead />
            <Script strategy="afterInteractive"
                    src={`https://www.googletagmanager.com/gtag/js?id=${ga}`}/>
            <Script id="gtag-init" strategy="afterInteractive"
                    dangerouslySetInnerHTML={{
                        __html: `
                      window.dataLayer = window.dataLayer || [];
                      function gtag(){dataLayer.push(arguments);}
                      gtag('js', new Date());
                      gtag('config', '${ga}');
                      `,
                    }}
            />
            <GlobalStyle/>
            <CacheProvider value={emotionCache}>
                <SessionProvider session={session}>
                    <ThemeProvider defaultTheme="dark">
                        <Layout>
                            {pageLoading && <Loading/>}
                            <DevSupport ComponentPreviews={ComponentPreviews}
                                        useInitialHook={useInitial}
                            >
                                <Component {...pageProps} />
                            </DevSupport>
                        </Layout>
                    </ThemeProvider>
                </SessionProvider>
            </CacheProvider>
        </>
    );
}
App.propTypes = {
    Component: PropTypes.elementType.isRequired,
    emotionCache: PropTypes.object,
    pageProps: PropTypes.object.isRequired,
}
