import 'dotenv/config'
import {readFile} from 'node:fs/promises'
import {PrismaMariaDb} from '@prisma/adapter-mariadb'
import {PrismaClient} from '../generated/prisma/client'
import {getMariaDbConnectionString} from '../lib/prismaConnection'
import {seedLegacyLimitedIdeas} from './legacyLimitedIdeas.mjs'

async function main() {
    const args = process.argv.slice(2)
    if (args.some(arg => arg !== '--dry-run')) throw new Error('Usage: tsx prisma/seed-limited-ideas.ts [--dry-run]')
    const fixture = JSON.parse(await readFile(new URL('./fixtures/limited-ideas-legacy.json', import.meta.url), 'utf8'))
    const prisma = new PrismaClient({adapter: new PrismaMariaDb(getMariaDbConnectionString())})
    try {
        console.log(JSON.stringify(await seedLegacyLimitedIdeas(prisma, fixture, {dryRun: args.includes('--dry-run')}), null, 2))
    } finally {
        await prisma.$disconnect()
    }
}

main().catch(() => {
    // Database errors may contain connection details or user data. Do not dump them.
    console.error('Legacy import failed. Check migrations, fixture and creator accounts with --dry-run.')
    process.exitCode = 1
})
