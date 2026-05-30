/**
 *  @type {import('next').NextConfig}
 */

const nextConfig = {
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
  },
  compiler: {
    styledComponents: true
  }
}

export default nextConfig
