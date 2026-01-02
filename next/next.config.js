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
  async redirects() {
    return [
      {
        source: '/ja/:path*',
        destination: '/:path*',
        permanent: true,
        locale: false
      }
    ]
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

