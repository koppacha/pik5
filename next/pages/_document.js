import Document, { Html, Head, Main, NextScript } from 'next/document'
import createEmotionCache from '../lib/createEmotionCache';
import createEmotionServer from '@emotion/server/create-instance';
import PropTypes from "prop-types";

export default function MyDocument(props) {

    const { emotionStyleTags, locale } = props

    return (
        <Html lang={locale || "ja"}>
          <Head>
              <meta charSet="utf-8"/>
              <meta name="emotion-insertion-point" content=""/>
              <script
                  dangerouslySetInnerHTML={{
                      __html: `
                        try {
                          var storedTheme = window.localStorage.getItem('theme');
                          document.documentElement.dataset.theme = storedTheme || 'dark';
                        } catch (e) {
                          document.documentElement.dataset.theme = 'dark';
                        }
                      `,
                  }}
              />
              {emotionStyleTags}
              <link rel="icon" href="/favicon.ico" />
          </Head>
          <body>
            <Main />
            <NextScript />
          </body>
        </Html>
    )
}

MyDocument.getInitialProps = async (ctx) => {
    const originalRenderPage = ctx.renderPage
    const cache = createEmotionCache()
    const {extractCriticalToChunks} = createEmotionServer(cache)

    ctx.renderPage = () =>
        originalRenderPage({
            enhanceApp: (App) =>
                function EnhanceApp(props){
                    return <App emotionCache={cache} {...props} />
                },
        })
    const initialProps = await Document.getInitialProps(ctx)
    const emotionStyles = extractCriticalToChunks(initialProps.html)
    const emotionStyleTags = emotionStyles.styles.map((style) => (
        <style
            data-emotion={`${style.key} ${style.ids.join(' ')}`}
            key={style.key}
            dangerouslySetInnerHTML={{ __html: style.css }} />
    ))
    return {
        ...initialProps,
        emotionStyleTags,
        locale: ctx.locale || ctx.defaultLocale || "ja",
    }
}
MyDocument.prototypes = {
    emotionStyleTags: PropTypes.array.isRequired,
}
