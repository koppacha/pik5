import { defineNitroConfig } from "nitropack";

// https://nitro.unjs.io/config#devproxy
// https://github.com/http-party/node-http-proxy#options
export default defineNitroConfig({
    devProxy: {
        '/api/': {
            target: 'http://laravel:8000/api/',
            changeOrigin: true,
            hostRewrite: true,
            cookieDomainRewrite: true,
            headers: {
                'X-Forwarded-Host': 'localhost:3000',
                'X-Forwarded-Proto': 'http'
            }
        }
    }
})
