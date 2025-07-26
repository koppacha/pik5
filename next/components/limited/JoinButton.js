import Button from '@mui/material/Button'

export default function JoinButton({ session }) {
    const handleJoin = async () => {

        await fetch(`/api/server/join?userId=${session.user.id}`, {method: 'POST'})
        window.location.reload()
    }

    return (
        <Button
            variant="contained"
            disabled={!session}
            onClick={handleJoin}
        >参加する</Button>
    )
}