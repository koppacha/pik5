import {getServerSession} from 'next-auth/next'
import {authOptions} from './auth/[...nextauth]'
import prisma from '../../lib/prisma'
import {createLimitedIdeasHandler} from '../../lib/limitedIdeasApi'

export const config = {api: {bodyParser: {sizeLimit: '8kb'}}}

export default createLimitedIdeasHandler({
    prisma,
    getSession: (req, res) => getServerSession(req, res, authOptions),
    siteUrl: process.env.NEXTAUTH_URL,
})
