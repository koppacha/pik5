// キャッシュを削除するAPI
export default async function handler(req, res) {
    const { authorization } = req.headers
    if(!authorization || authorization !== `Bearer ${process.env.NEXT_PUBLIC_API_SECRET}`) {
        return res.status(401).json({message: 'Unauthorized'})
    }
    if (req.method === 'POST') {
        const { id, page } = req.query;

        try {
            if(id && page){
                await res.revalidate(`/${page}/${id}`);
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
