import '@/styles/globals.css';
import Layout from '../components/Layout';
import { config } from '@fortawesome/fontawesome-svg-core';
import '@fortawesome/fontawesome-svg-core/styles.css';
import {ThemeProvider} from "next-themes";
import { SessionProvider } from "next-auth/react";
import {GlobalStyle} from "../styles/pik5.css";
import {useEffect} from "react";
import Script from "next/script";
import {ga, pageView} from "../lib/gtag";
import {useRouter} from "next/router";

config.autoAddCss = false

export default function App({ Component, pageProps: { session, ...pageProps } }) {

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
          <SessionProvider session={session}>
              <ThemeProvider defaultTheme="dark">
                  <Layout>
                      <Component {...pageProps} />
                  </Layout>
              </ThemeProvider>
          </SessionProvider>
      </>
    );
}
