import prisma from "./prisma"

const USERS_CACHE_TTL_MS = 60 * 60 * 1000

function getUsersCacheStore() {
    if (!global.usersCacheStore) {
        global.usersCacheStore = {
            basic: null,
            basicExpiresAt: 0,
            basicPromise: null,
            withRole: null,
            withRoleExpiresAt: 0,
            withRolePromise: null,
        }
    }
    return global.usersCacheStore
}

export async function getCachedUsers() {
    const cache = getUsersCacheStore()
    if (cache.basic && cache.basicExpiresAt > Date.now()) {
        return cache.basic
    }
    if (cache.basicPromise) {
        return cache.basicPromise
    }

    cache.basicPromise = prisma.user.findMany({
        select: {
            userId: true,
            name: true,
        },
    }).then((users) => {
        cache.basic = users
        cache.basicExpiresAt = Date.now() + USERS_CACHE_TTL_MS
        return users
    }).finally(() => {
        cache.basicPromise = null
    })

    return cache.basicPromise
}

export async function getCachedUsersWithRole() {
    const cache = getUsersCacheStore()
    if (cache.withRole && cache.withRoleExpiresAt > Date.now()) {
        return cache.withRole
    }
    if (cache.withRolePromise) {
        return cache.withRolePromise
    }

    cache.withRolePromise = prisma.user.findMany({
        select: {
            userId: true,
            name: true,
            role: true,
        },
    }).then((users) => {
        cache.withRole = users
        cache.withRoleExpiresAt = Date.now() + USERS_CACHE_TTL_MS
        return users
    }).finally(() => {
        cache.withRolePromise = null
    })

    return cache.withRolePromise
}
