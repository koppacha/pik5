/**
 *  @type {import('next').NextConfig}
 */

const nextConfig = {
  staticPageGenerationTimeout: 180,
  reactStrictMode: true,
  async headers() {
    return [
      {
        source: "/games/mitite_shooting_simulator_build/Build/mitite_shooting_simulator_build.data.br",
        headers: [
          {key: "Content-Encoding", value: "br"},
          {key: "Content-Type", value: "application/octet-stream"}
        ]
      },
      {
        source: "/games/mitite_shooting_simulator_build/Build/mitite_shooting_simulator_build.framework.js.br",
        headers: [
          {key: "Content-Encoding", value: "br"},
          {key: "Content-Type", value: "application/javascript"}
        ]
      },
      {
        source: "/games/mitite_shooting_simulator_build/Build/mitite_shooting_simulator_build.wasm.br",
        headers: [
          {key: "Content-Encoding", value: "br"},
          {key: "Content-Type", value: "application/wasm"}
        ]
      }
    ]
  },
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

export default nextConfig
