import prisma from "../../lib/prisma"
import {clearSpeedrunCacheForUsername} from "../../lib/speedrunRecords"

// キャッシュを削除するAPI
export default async function handler(req, res) {
    // const { authorization } = req.headers
    // if(!authorization || authorization !== `Bearer ${process.env.NEXT_PUBLIC_API_SECRET}`) {
    //     return res.status(401).json({message: 'Unauthorized'})
    // }
    if (req.method === 'POST') {
        let { id, page } = req.query

        try {
            // ページ種別とステージIDは必須
            if(id && page){
                if (page === "user") {
                    const user = await prisma.user.findFirst({
                        where: {userId: String(id)},
                        select: {srcUserId: true},
                    })
                    clearSpeedrunCacheForUsername(user?.srcUserId)
                }
                const targets = [`/${page}/${id}`]
                await Promise.all(targets.map((target) => res.revalidate(target)))
            }
            return res.json({ revalidated: true });
        } catch (err) {
            return res.status(500).send('Error revalidating');
        }
    } else {
        res.setHeader('Allow', ['POST']);
        res.status(405).end(`Method ${req.method} Not Allowed`);
    }
}
