import { Html, Head, Main, NextScript } from 'next/document'
import {useLocale} from "../lib/pik5";

export default function Document() {

    return (
        <Html lang="ja">
          <Head>
              <meta charSet="utf-8"/>
              <meta name="description" content="" />
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
