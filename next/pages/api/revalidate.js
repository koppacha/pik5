// キャッシュを削除するAPI
export default async function handler(req, res) {
    // const { authorization } = req.headers
    // if(!authorization || authorization !== `Bearer ${process.env.NEXT_PUBLIC_API_SECRET}`) {
    //     return res.status(401).json({message: 'Unauthorized'})
    // }
    if (req.method === 'POST') {
        let { id, page, console = 0, rule = 0, year } = req.query

        // 年がfalsyな場合はとりあえず今年にする
        if(!year){
            const now = new Date()
            year = now.getFullYear()
        }

        try {
            // ページ種別とステージIDは必須
            if(id && page){
                await res.revalidate(`/${page}/${id}`)
                // 操作方法が０以外なら操作方法別もリフレッシュ
                if(console){
                    await res.revalidate(`/${page}/${id}/${console}`)
                }
                // ルールが０以外ならルール別もリフレッシュ
                if(rule){
                    await res.revalidate(`/${page}/${id}/${console}/${rule}/${year}`)
                }
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
