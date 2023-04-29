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

// import {
//     CachesType,
//     createCache,
//     getDataFromTree,
// } from "@react-libraries/use-ssr";
// import { AppContext, AppProps } from "next/app";
//
// const App = (props: AppProps & { cache: CachesType }) => {
//     const { Component, cache } = props;
//     createCache(cache);
//     return <Component />;
// };
// App.getInitialProps = async ({ Component, router, AppTree }: AppContext) => {
//     const cache = await getDataFromTree(
//         <AppTree Component={Component} pageProps={{}} router={router} />
//     );
//     return { cache };
// };
// export default App;