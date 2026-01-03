/**
 *  @type {import('next').NextConfig}
 */

module.exports = {
  staticPageGenerationTimeout: 180,
  reactStrictMode: true,
  i18n: {
    locales: ["en", "ja"],
    defaultLocale: "ja",
    localeDetection: false
  },
  images: {
    remotePatterns: [
      {
        protocol: 'http',
        hostname: 'laravel',
        port: '8000',
      }
    ]
  }
}

