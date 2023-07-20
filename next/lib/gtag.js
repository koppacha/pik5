// Googleアナリティクスのタグ
import Script from "next/script";

export const ga = process.env.NEXT_PUBLIC_GAID

// ページカウンター
export const pageView = (url) =>
    <Script strategy="afterInteractive"
            dangerouslySetInnerHTML={{
                __html:`
                        window.gtag("config", '${ga}', {
                            page_path: ${url},
                        })
                    `}}/>