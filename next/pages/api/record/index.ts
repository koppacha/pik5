// Next.js API route support: https://nextjs.org/docs/api-routes/introduction
import type { NextApiRequest, NextApiResponse } from 'next'

type Data = {
  posts: any
}

export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse<Data>
) {
    // TODO: 接続拒否されて使えない。当面コンポーネント内フェッチで代用
    const response = await fetch('http://localhost:8000/api/record/201',
      {
          method: 'GET'
      })
        .then(data => data.json())
        .catch(error => {
          console.error('error', error)
        })
        res.status(200).json({ posts: response })
}

