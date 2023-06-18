import {PrismaClient} from '@prisma/client'
import bcrypt from 'bcrypt'

const prisma = new PrismaClient()

async function main() {
    const saltRounds = 10;
    const password = "test"
    const hashedPassword = await bcrypt.hash(password, saltRounds)
    const testUser = await prisma.user.upsert({
        where: { email: 'test@test.com' },
        update: {},
        create: {
            email: 'test@test.com',
            name: 'テスト',
            crypted_password: hashedPassword
        },
    })

    console.log({ testUser })
}

main()
    .catch((e) => {
        console.error(e)
        process.exit(1)
    })
    .finally(async () => {
        await prisma.$disconnect()
    })