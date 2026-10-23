import assert from 'node:assert/strict'
import {test} from 'node:test'
import {formatSpeedrunTime, speedrunRecordData} from '../lib/yearRecordPresentation.mjs'

test('RTA display retains milliseconds and carries rounding into minutes and hours', () => {
    assert.equal(formatSpeedrunTime(0), '00:00')
    assert.equal(formatSpeedrunTime(123.456), '02:03.456')
    assert.equal(formatSpeedrunTime(59.9996), '01:00')
    assert.equal(formatSpeedrunTime(3599.9996), '1:00:00')
})

test('RTA adapter retains the board, rank, evidence and all player names for the shared Record component', () => {
    const run = {rank: 7, time: 123.456, submitted: '2024-12-31T14:59:59Z',
        players: [{key: 'guest:Synthetic guest', name: 'Synthetic guest'}, {key: 'test-player', name: 'Test player'}],
        videoUrl: 'https://example.com/video'}
    const data = speedrunRecordData(run, {stage: 101, console: 2})
    assert.equal(data.category, 'speedrun')
    assert.equal(data.post_rank, 7)
    assert.equal(data.created_at, run.submitted)
    assert.equal(data.stage_id, 101)
    assert.equal(data.console, 2)
    assert.equal(data.user_name, 'Synthetic guest / Test player')
    assert.equal(data.video_url, run.videoUrl)
    assert.equal('rps' in data, false)
})
