export function getMariaDbConnectionString(databaseUrl = process.env.DATABASE_URL) {
    if (!databaseUrl) {
        throw new Error('DATABASE_URL is not set')
    }

    const url = new URL(databaseUrl)

    if (url.protocol === 'mysql:') {
        url.protocol = 'mariadb:'
    }

    url.searchParams.delete('schema')

    if (!url.searchParams.has('allowPublicKeyRetrieval')) {
        url.searchParams.set('allowPublicKeyRetrieval', 'true')
    }

    return url.toString()
}
