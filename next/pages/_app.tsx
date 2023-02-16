import '@/styles/globals.css'
import Layout from '@/components/Layout'
import type { AppProps } from 'next/app'
import { config } from '@fortawesome/fontawesome-svg-core'
import '@fortawesome/fontawesome-svg-core/styles.css'
config.autoAddCss = false

export default function App({ Component, pageProps: { session, ...pageProps }, router }: AppProps) {

    return (
      <>
          <Layout>
              <Component {...pageProps} />
          </Layout>
      </>
    );
}
