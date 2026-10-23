// Local-container helper. Credentials exist only in dedicated test environment variables.
require('dotenv/config')
const bcrypt = require('bcrypt')

async function main() {
    const {PrismaClient} = await import('../generated/prisma/client.ts')
    const {PrismaMariaDb} = await import('@prisma/adapter-mariadb')
    const {getMariaDbConnectionString} = await import('../lib/prismaConnection.js')
    const prisma = new PrismaClient({adapter: new PrismaMariaDb(getMariaDbConnectionString())})
    try {
        const userId = process.env.PIK5_TEST_USER_ID || ''
        if (!/^codex_dandori_[a-f0-9]{8}$/.test(userId)) throw new Error('Dedicated test identity required')
        if (process.argv.includes('--delete')) {
            await prisma.user.deleteMany({where: {userId}})
            return
        }
        const password = process.env.PIK5_POST_TEST_PASSWORD
        if (!password) throw new Error('Test password environment variable required')
        const user = await prisma.user.create({data: {userId, name: 'Codex 検定テスト', role: '10', password: await bcrypt.hash(password, 10)}})
        process.stdout.write(JSON.stringify({dbId: user.id}))
    } finally {
        await prisma.$disconnect()
    }
}

main().catch(() => {console.error('Dedicated test identity operation failed'); process.exitCode = 1})
