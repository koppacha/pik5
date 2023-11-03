import Button from "@mui/material/Button";
import {fetcher, useLocale} from "../lib/pik5";
import {useSession} from "next-auth/react";
import useSWR from "swr";

export default function PostButton({voteId}){

    const {t} = useLocale()
    const {data: session} = useSession()
    const now = new Date().toLocaleString()

    // if(!session) return null

    const {data} = useSWR(`/api/server/vote/${voteId}/${session?.user?.id}`, fetcher)

    console.log(data)

    if(!data) return null

    const onSubmit = async (id) => {
        const confirm = window.confirm(t.g.confirm)

        if (confirm) {
            const res = await fetch('/api/server/vote', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    'user': session.user.id ?? "guest",
                    'vote': voteId,
                    'select': id,
                    'created_at': now,
                })
            })
        }
    }
    return (
        <>
            <Button onClick={() => onSubmit(1)}>Button 1</Button>
            <Button onClick={() => onSubmit(2)}>Button 2</Button>
            <Button onClick={() => onSubmit(3)}>Button 3</Button>
            <Button onClick={() => onSubmit(4)}>Button 4</Button>
        </>
    )
}