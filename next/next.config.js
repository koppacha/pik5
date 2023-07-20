/**
 *  @type {import('next').NextConfig}
 */

module.exports = {
  staticPageGenerationTimeout: 180,
  reactStrictMode: true,
  i18n: {
    locales: ["en", "ja"],
    defaultLocale: "ja"
  },
  compiler: {
    styledComponents: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'http',
        hostname: 'laravel',
        port: '8000',
      }
    ]
  },
}

