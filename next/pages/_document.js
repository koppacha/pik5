import Document, { Html, Head, Main, NextScript } from 'next/document'
import createEmotionCache from '../lib/createEmotionCache';
import createEmotionServer from '@emotion/server/create-instance';
import PropTypes from "prop-types";

export default function MyDocument(props) {

    const { emotionStyleTags } = props

    return (
        <Html lang="ja">
          <Head>
              <meta charSet="utf-8"/>
              <meta name="description" content="" />
              <meta name="emotion-insertion-point" content=""/>
              {emotionStyleTags}
              <link rel="icon" href="/favicon.ico" />
              <link rel="preconnect" href="https://fonts.googleapis.com"/>
              <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin=""/>
              <link
                  href="https://fonts.googleapis.com/css2?family=Inder&family=Kulim+Park:wght@200;300;400;600;700&family=M+PLUS+1+Code:wght@100;200;300;400;500;600;700&family=Oldenburg&family=Outfit:wght@100;200;300;400;500;600;700;800;900&family=Proza+Libre:wght@400;500;600;700;800&display=swap"
                  rel="stylesheet"/>
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
    }
}
MyDocument.prototypes = {
    emotionStyleTags: PropTypes.array.isRequired,
}