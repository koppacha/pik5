import bcrypt from 'bcrypt'
import { PrismaMariaDb } from '@prisma/adapter-mariadb'
import { PrismaClient } from '../generated/prisma/client'
import { getMariaDbConnectionString } from '../lib/prismaConnection'
import { data } from './data/data'

const adapter = new PrismaMariaDb(getMariaDbConnectionString())
const prisma = new PrismaClient({adapter})

const exitUsers = data
const postApiTestUserId = 'codex_post_api_test'
const postApiTestUserName = 'Codex Post API Test'

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

    if(process.env.PIK5_POST_TEST_PASSWORD){
        const hashedPassword = bcrypt.hashSync(process.env.PIK5_POST_TEST_PASSWORD, saltRounds)

        await prisma.user.upsert({
            where: {userId: postApiTestUserId},
            update: {
                name: postApiTestUserName,
                password: hashedPassword,
                role: '',
            },
            create: {
                userId: postApiTestUserId,
                name: postApiTestUserName,
                password: hashedPassword,
                role: '',
            },
        })
    }
}

main()
    .catch((error) => {
        console.error(error)
        process.exit(1)
    })
    .finally(async () => {
        await prisma.$disconnect()
    })
