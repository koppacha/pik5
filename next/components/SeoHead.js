import Head from 'next/head'
import {useRouter} from 'next/router'
import {buildLocalizedPath, stripLocalePrefix, toAbsoluteUrl} from '../lib/seo'

const defaultDescription = {
  ja: 'ピクミンシリーズのランキング・記録・攻略情報を共有するサイトです。',
  en: 'Pikmin challenge rankings, records, and community guides on Pik5.'
}

export default function SeoHead({
  title,
  description,
  canonicalPath,
  noindex = false,
  jsonLd
}) {
  const router = useRouter()
  const locale = router.locale || 'ja'
  const currentPath = canonicalPath || router.asPath || '/'

  const canonical = toAbsoluteUrl(buildLocalizedPath(currentPath, locale))
  const basePath = stripLocalePrefix(currentPath)
  const jaAlt = toAbsoluteUrl(buildLocalizedPath(basePath, 'ja'))
  const enAlt = toAbsoluteUrl(buildLocalizedPath(basePath, 'en'))

  const safeDescription = description || defaultDescription[locale] || defaultDescription.ja

  return (
    <Head>
      {title && <title>{title}</title>}
      <meta name='description' content={safeDescription} />
      <meta name='robots' content={noindex ? 'noindex,nofollow' : 'index,follow'} />
      <link rel='canonical' href={canonical} />
      <link rel='alternate' hrefLang='ja' href={jaAlt} />
      <link rel='alternate' hrefLang='en' href={enAlt} />
      <link rel='alternate' hrefLang='x-default' href={jaAlt} />

      <meta property='og:type' content='website' />
      {title && <meta property='og:title' content={title} />}
      <meta property='og:description' content={safeDescription} />
      <meta property='og:url' content={canonical} />
      <meta property='og:site_name' content='ピクチャレ大会' />

      <meta name='twitter:card' content='summary' />
      {title && <meta name='twitter:title' content={title} />}
      <meta name='twitter:description' content={safeDescription} />

      {jsonLd && (
        <script
          type='application/ld+json'
          dangerouslySetInnerHTML={{__html: JSON.stringify(jsonLd)}}
        />
      )}
    </Head>
  )
}
