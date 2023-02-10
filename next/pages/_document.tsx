import { Html, Head, Main, NextScript } from 'next/document'

export default function Document() {
  return (
    <Html lang="en">
      <Head>
          <link rel="preconnect" href="https://fonts.googleapis.com"/>
          <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
          <link
              href="https://fonts.googleapis.com/css2?family=Inder&family=Kulim+Park:wght@200;300;400;600;700&family=Oldenburg&family=Outfit:wght@100;200;300;400;500;600;700;800;900&family=Proza+Libre:wght@400;500;600;700;800&display=swap"
              rel="stylesheet"/>
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  )
}
