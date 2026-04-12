import bcrypt from 'bcrypt'
import { PrismaMariaDb } from '@prisma/adapter-mariadb'
import { PrismaClient } from '../generated/prisma/client'
import { getMariaDbConnectionString } from '../lib/prismaConnection'
import { data } from './data/data'

const adapter = new PrismaMariaDb(getMariaDbConnectionString())
const prisma = new PrismaClient({adapter})

const exitUsers = data

async function main() {
    const saltRounds = 10
    const users = exitUsers.map((user) => {
        const hashedPassword = bcrypt.hashSync(user.password, saltRounds)
        return {
            userId: user.user_id,
            name: user.user_name,
            password: hashedPassword,
            role: user.role,
        }
    })

    await prisma.user.createMany({
        data: users,
        skipDuplicates: true,
    })
}

main()
    .catch((error) => {
        console.error(error)
        process.exit(1)
    })
    .finally(async () => {
        await prisma.$disconnect()
    })
