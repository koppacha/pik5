import Button from "@mui/material/Button";
import {fetcher, useLocale} from "../lib/pik5";
import {useSession} from "next-auth/react";
import useSWR from "swr";
import {CustomButton} from "../styles/pik5.css";

export default function PostButton({voteId}){

    const {t} = useLocale()
    const {data: session} = useSession()
    const now = new Date().toLocaleString()

    const onSubmit = async (id) => {
        const confirm = window.confirm(t.g.confirm)

        if (confirm) {
            const res = await fetch('/api/server/vote', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    'user': session.user.userId ?? "guest",
                    'vote': voteId,
                    'select': id,
                    'created_at': now,
                })
            })
            if (res.status < 300) {
                console.log(res)
            }
        }
    }
    if(!session){
        return (
            <>
                このイベントに参加するにはログインしてください。
            </>
        )
    }
    return (
        <>
            <CustomButton onClick={() => onSubmit(1)}>このイベントに参加する</CustomButton>
        </>
    )
}