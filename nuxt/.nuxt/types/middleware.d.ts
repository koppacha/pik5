import type { NavigationGuard } from 'vue-router'
export type MiddlewareKey = "api"
declare module "/var/www/nuxt/node_modules/nuxt/dist/pages/runtime/composables" {
  interface PageMeta {
    middleware?: MiddlewareKey | NavigationGuard | Array<MiddlewareKey | NavigationGuard>
  }
}