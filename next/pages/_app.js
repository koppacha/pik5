import '@/styles/globals.css';
import Layout from '../components/Layout';
import '@fortawesome/fontawesome-svg-core/styles.css';
import {ThemeProvider} from "next-themes";
import { SessionProvider } from "next-auth/react";
import {GlobalStyle} from "../styles/pik5.css";
import {useEffect} from "react";
import Script from "next/script";
import {ga, pageView} from "../lib/gtag";
import {useRouter} from "next/router";
import createEmotionCache from "../lib/createEmotionCache";
import {CacheProvider} from "@emotion/react";
import PropTypes from "prop-types";

const clientSideEmotionCache = createEmotionCache()

export default function App(props) {
    const {Component, emotionCache = clientSideEmotionCache, pageProps: { session, ...pageProps } } = props

    const router = useRouter()
    useEffect(() => {
        const handleRouterChange = (url) => {
            pageView(url)
        }
        router.events.on("routeChangeComplete", handleRouterChange)
        return () => {
            router.events.off("routeChangeComplete", handleRouterChange)
        }
    }, [router.events])

    return (
      <>
          <Script strategy="afterInteractive"
                  src="https://www.googletagmanager.com/gtag/js?id=${ga}"/>
          <Script id="gtag-init" strategy="afterInteractive"
                  dangerouslySetInnerHTML={{
                      __html:`
                      window.dataLayer = window.dataLayer || [];
                      function gtag(){dataLayer.push(arguments);}
                      gtag('js', new Date());
                      gtag('config', '${ga}');
                      `,
                  }}
          />
          <Script id="juicer" strategy="afterInteractive"
                  src="//kitchen.juicer.cc/?color=YICiPNPXjTM=" async/>
          <GlobalStyle/>
          <CacheProvider value={emotionCache}>
              <SessionProvider session={session}>
                  <ThemeProvider defaultTheme="dark">
                      <Layout>
                          <Component {...pageProps} />
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