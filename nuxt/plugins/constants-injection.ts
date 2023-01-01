import * as C from '~/common/constants'

export default defineNuxtPlugin(nuxtApp => {
    return {
        provide: {
            C
        }
    }
})
