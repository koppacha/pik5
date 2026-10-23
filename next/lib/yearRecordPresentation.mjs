export function formatSpeedrunTime(seconds) {
    const milliseconds = Math.round(seconds * 1000)
    const whole = Math.floor(milliseconds / 1000)
    const hours = Math.floor(whole / 3600)
    const minutes = String(Math.floor(whole / 60) % 60).padStart(2, '0')
    const secs = String(whole % 60).padStart(2, '0')
    const fraction = milliseconds % 1000
    return `${hours ? `${hours}:` : ''}${minutes}:${secs}${fraction ? `.${String(fraction).padStart(3, '0')}` : ''}`
}

export function speedrunRecordData(run, board) {
    return {
        category: 'speedrun',
        post_rank: run.rank,
        score: run.time,
        stage_id: board.stage,
        console: board.console,
        created_at: run.submitted,
        user_id: run.players[0]?.key || '',
        user_name: run.players.map(player => player.name).join(' / '),
        video_url: run.videoUrl,
        post_comment: '',
    }
}
