import { PrismaMariaDb } from '@prisma/adapter-mariadb'
import { PrismaClient } from '../generated/prisma/client'
import { getMariaDbConnectionString } from './prismaConnection'

let prisma

function createPrismaClient() {
    const adapter = new PrismaMariaDb(getMariaDbConnectionString())
    return new PrismaClient({adapter})
}

if (process.env.NODE_ENV === 'production') {
    prisma = createPrismaClient()
} else {
    if (!global.prisma) {
        global.prisma = createPrismaClient()
    }
    prisma = global.prisma
}

export default prisma
