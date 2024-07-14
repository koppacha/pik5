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
import {faCircleNotch} from "@fortawesome/free-solid-svg-icons";
import {FontAwesomeIcon} from "@fortawesome/react-fontawesome";
import * as React from "react";
import {DevSupport} from "@react-buddy/ide-toolbox-next";
import {ComponentPreviews, useInitial} from "../dev";

const clientSideEmotionCache = createEmotionCache()

export default function App(props) {
    const {Component, emotionCache = clientSideEmotionCache, pageProps: {session, ...pageProps}} = props

    const router = useRouter()
    const [pageLoading, setPageLoading] = useState(false)

    useEffect(() => {
        const handleStart = (url) => url !== router.asPath && setPageLoading(true)
        const handleComplete = () => setPageLoading(false)
        const handleRouterChange = (url) => {
            pageView(url)
        }
        router.events.on("routeChangeStart", handleStart)
        router.events.on("routeChangeComplete", handleComplete)
        router.events.on("routeChangeComplete", handleRouterChange)
        router.events.on("routeChangeError", handleComplete)
        return () => {
            router.events.off("routeChangeStart", handleStart)
            router.events.off("routeChangeComplete", handleComplete)
            router.events.off("routeChangeComplete", handleRouterChange)
            router.events.off("routeChangeError", handleComplete)
        }
    }, [router.events])

    function Loading() {
        return <div className="loading-layer">
            <FontAwesomeIcon icon={faCircleNotch} spin/> Loading...
        </div>
    }

    return (
        <>
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
                        {pageLoading && <Loading/>}
                        <Layout>
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