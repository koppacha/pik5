// このスクリプトではimport構文は使えないっぽい
const {PrismaClient} = require('@prisma/client')
const bcrypt = require('bcrypt')
const {data} = require('./data/data')

const prisma = new PrismaClient()

// 旧ピクチャレ大会からユーザー情報をインポート
const exitUsers = data

async function main() {
    const saltRounds = 10;
    const users = exitUsers.map((user) => {
        const hashedPassword = bcrypt.hashSync(user.password, saltRounds)
        return {
            userId: user.user_id,
            name: user.user_name,
            password: hashedPassword,
            role: user.role
        }
    })
    await prisma.user.createMany({
        data: users,
        skipDuplicates: true
    })
}

main()
    .catch((e) => {
        console.error(e)
        process.exit(1)
    })
    .finally(async () => {
        await prisma.$disconnect()
    })