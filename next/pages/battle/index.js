import React, {useState} from 'react';
import {Box, Button, Container, Grid, Typography} from '@mui/material';
import {StyledTextField} from "../../styles/pik5.css";
import {rankColor} from "../../lib/pik5";

const arrayA = ["こてしらべの戦い", "戦場のおもちゃ箱", "風雲ダンドリ城", "決戦のオアシス", "熱砂の決闘場", "最果ての闘技場"];
const arrayB = ["赤ピクミン", "黄ピクミン", "青ピクミン", "岩ピクミン", "羽ピクミン", "紫ピクミン", "白ピクミン", "氷ピクミン"]
const players = ["こっぱちゃ", "こばちのうどん", "mercysnow", "リーヌァ", "エープリル", "albut3"]

function generateRandomHex(length){
    return Math.floor(Math.random() * Math.pow(16, length).toString(16).padStart(length, "0"))
}
const sessionId = generateRandomHex(9)

export default function Battle() {
    const [grids, setGrids] = useState([])
    const [history, setHistory] = useState([])
    const [historyA, setHistoryA] = useState([])
    const [historyB, setHistoryB] = useState([])
    const [count, setCount] = useState(0)
    const [rates, setRates] = useState(players.reduce((acc, player) => ({...acc, [player]: 1000}), {}))
    const [pool, setPool] = useState(0)

    const getRandomStages = (arrayA, arrayB, history, setHistory, historyA, setHistoryA, historyB, setHistoryB) => {
        const allStages = []
        arrayA.forEach(a => {
            arrayB.forEach(b => {
                allStages.push([a, b])
            })
        })
        const availableStages = allStages.filter(stage => {
            return !history.some(h => h[0] === stage[0] && h[1] === stage[1])
        })
        if (availableStages.length === 0) {
            setHistory([])
            return getRandomStages(arrayA, arrayB, [], setHistory, historyA, setHistoryA, historyB, setHistoryB)
        } else {
            const recentA = historyA.slice(0, 3)
            const recentB = historyB.slice(0, 3)
            const filteredStages = availableStages.filter(combination => {
                return !recentA.includes(combination[0]) && !recentB.includes(combination[1])
            })
            const finalStages = filteredStages.length > 0 ? filteredStages : availableStages
            const randomIndex = Math.floor(Math.random() * finalStages.length);
            const selectedStages = finalStages[randomIndex]

            setHistory([[selectedStages[0], selectedStages[1]], ...history])
            setHistoryA([selectedStages[0], ...historyA].slice(0, 3))
            setHistoryB([selectedStages[1], ...historyB].slice(0, 3))

            return selectedStages
        }
    }
    const handleButtonClick = () => {
        const [selectedItemA, selectedItemB] = getRandomStages(arrayA, arrayB, history, setHistory, historyA, setHistoryA, historyB, setHistoryB)
        const battleId = generateRandomHex(9)
        const newGrid = {
            id: count,
            itemA: selectedItemA,
            itemB: selectedItemB,
            battleId: battleId,
            players: players.map(player => ({
                name: player,
                scoreA: 0,
                scoreB: 0,
                scoreC: 0,
                rank: 0,
                rate: rates[player],
                initialRate: rates[player]
            }))
        }
        setGrids([newGrid, ...grids])
        setCount(count + 1)
    }
    const handleScoreChange = (gridId, playerName, field, value) => {
        setGrids(prevGrids => {
            return prevGrids.map(grid => {
                if (grid.id === gridId) {
                    const updatedPlayers = grid.players.map(player => {
                        if (player.name === playerName) {
                            const updatedPlayer = {...player, [field]: value}
                            updatedPlayer.scoreC = updatedPlayer.scoreA - updatedPlayer.scoreB
                            return updatedPlayer
                        }
                        return player
                    })
                    const sortedPlayers = [...updatedPlayers].sort((a, b) => b.scoreC - a.scoreC)
                    sortedPlayers.forEach((player, index, array) => {
                        player.rank = index + 1;
                        if (index > 0 && player.scoreC === array[index - 1].scoreC) {
                            player.rank = array[index - 1].rank;
                        }
                    })

                    const finalPlayers = updatedPlayers.map(player => ({
                        ...player,
                        rank: sortedPlayers.find(p => p.name === player.name).rank,
                    }))

                    return { ...grid, players: finalPlayers }
                }
                return grid
            })
        })
    }
    const handleScoreSubmit = () => {
        setGrids(prevGrids => {
            // 最新のグリッドを取得
            const latestGrid = prevGrids[0]
            let currentPool = 0

            // プレイヤーごとのレートを計算
            const updatedPlayers = latestGrid.players.map(player => {
                const contribution = Math.round(player.initialRate / 10)
                currentPool += contribution
                return { ...player, rate: player.initialRate - contribution }
            })

            setPool(currentPool)

            const sortedPlayers = [...updatedPlayers].sort((a, b) => b.scoreC - a.scoreC)
            const rewardRates = [0.4, 0.3, 0.2, 0.1];

            // Calculate rewards based on ranks
            let currentIndex = 0
            while (currentIndex < sortedPlayers.length && currentIndex < 4) {
                const sameRankCount = sortedPlayers.filter(p => p.rank === sortedPlayers[currentIndex].rank).length
                const totalRewardRate = rewardRates.slice(currentIndex, currentIndex + sameRankCount).reduce((acc, rate) => acc + rate, 0)
                const reward = Math.round(currentPool * totalRewardRate / sameRankCount)

                sortedPlayers.forEach((player) => {
                    if (player.rank === sortedPlayers[currentIndex].rank) {
                        player.rate += reward
                    }
                })
                currentIndex += sameRankCount
            }

            const finalPlayers = updatedPlayers.map(player => ({
                ...player,
                rate: sortedPlayers.find(p => p.name === player.name).rate,
                rank: sortedPlayers.find(p => p.name === player.name).rank,
            }));

            // Update player rates in the global state
            const newRates = { ...rates }
            finalPlayers.forEach(player => {
                newRates[player.name] = player.rate
            })
            setRates(newRates)

            // 更新されたグリッドを戻す
            return prevGrids.map((grid, index) => {
                if (index === 0) {
                    return { ...latestGrid, players: finalPlayers }
                }
                return grid
            })
        })
    }
    const onSubmit = async (grid) => {
        for (const player of grid.players) {
            const payload = {
                battleId: grid.battleId,
                scoreA: player.scoreA,
                scoreB: player.scoreA,
                scoreC: player.scoreA,
                rank: player.rank
            }
            try {
                await fetch('/api/battle', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(payload),
                })
                console.log(`Successfully submitted for ${player.name}`)
            } catch (e) {
                console.error(e)
            }
        }
    }
    return (
        <Container>
            <Typography variant="" className="title">ダンドリバトル大会戦績表</Typography><br/>
            <Typography variant="" className="subtitle">Online Dandori Battle</Typography><br/>
            <Box className="info-box">
                ダンドリバトル大会はピクミン４の「ダンドリバトル（vsCOM）」を同条件で同時にプレイし擬似的なオンライン対戦で競うイベントです。<br/>
                <br/>
                <ul>
                    <li>プレミア品：あり、ハテナカプセル：あり、<strong>逆転バクダン：なし</strong></li>
                    <li>スタートボタン（マップメニュー）は押下禁止。Yボタンメニューは故意の遅延行為を疑われない範囲でなら使用可能</li>
                    <li>みまわしドローンは使用禁止。</li>
                    <li>ハンデ設定は常にノーマル（COMもノーマル）</li>
                    <li>ステージとピクミンは毎回ランダム。ただし、同じ組み合わせは同一セッションの中で一度しか出現しない。セッションは主催が終了処理を行うか48回対戦するとリセットする。</li>
                    <li>各参加者は初参加時に1000点支給され、各対戦開始前に所持ポイントの10分の１をポットに支払う。（小数は四捨五入する。四捨五入の結果が０点でも参加は可能）</li>
                    <li>対戦後、[（自分のダンドリP）-（COMのダンドリP）]をプレイヤーの得点とし、それによって順位づけを行う。</li>
                    <li>１〜４位はそれぞれポットの４割、３割、２割、１割に相当するポイントを獲得する。５位以下はもらえない。</li>
                    <li>同点の場合は該当者がもらえるポイントを等分する。例えば２位が２名いる場合、ポットの５割を２等分する。</li>
                </ul>
                <Box style={{margin:"2em 1em",padding:"2em",fontSize:"0.9em",border:"1px solid red"}}>
                    <ul>
                        <li>当面の間システムはローカル運用のため、スコア入力は主催が行います。お手数ですが、ゲームが終了したら合図を送るまでリザルト画面を表示したまま待機してください。</li>
                        <li>画面共有時、可能であれば自身のハンドルネームを画面内に表示してください。</li>
                        <li>初参加の場合は、あらかじめローカル対戦用のダンドリバトルを全開放（熱砂の闘技場まで１回ずつプレイ）しておいてください。</li>
                    </ul>
                </Box>
            </Box>
            <Button variant="contained" color="primary" onClick={handleButtonClick}>
                セッションを追加
            </Button>
            {grids.map((grid, gridIndex) => (
                <Box key={grid.id} sx={{ mt: 2, p: 2, border: '1px solid grey' }}>
                    <Typography variant="span">#{grid.id + 1}</Typography><br/>
                    <Typography variant="span" style={{fontSize:"2em"}}>{grid.itemA} × {grid.itemB}</Typography>
                    <Grid container spacing={2} columns={players.length}>
                        {grid.players.map(function(player, playerIndex) {
                                const rankColorStr = rankColor(player.rank < 4 ? player.rank : 4, 0, 1)
                                return (
                                    <Grid item xs={1} key={player.name}>
                                        <Typography variant="span">{player.name}</Typography><br/>
                                        <StyledTextField
                                            type="number"
                                            value={player.scoreA || ""}
                                            style={{minWidth: "100px", marginBottom: "10px"}}
                                            onChange={(e) => handleScoreChange(grid.id, player.name, 'scoreA', parseInt(e.target.value, 10) || 0)}
                                            flilWidth
                                        />
                                        <StyledTextField
                                            type="number"
                                            value={player.scoreB || ""}
                                            style={{minWidth: "100px", marginBottom: "20px"}}
                                            onChange={(e) => handleScoreChange(grid.id, player.name, 'scoreB', parseInt(e.target.value, 10) || 0)}
                                            flilWidth
                                        />
                                        <Box style={{padding:"4px",fontSize:"1em",borderBottom:`1px solid ${rankColorStr}`,borderLeft:`5px solid ${rankColorStr}`,borderRadius:"4px"}}>{player.scoreC} pts. ({player.rank} 位)</Box>
                                    </Grid>
                                )
                            }
                        )}
                    </Grid>
                    <Button
                        variant="contained"
                        style={{marginTop:"10px"}}
                        onClick={() => handleScoreSubmit(grid.id)}>
                        レートを計算する
                    </Button>
                </Box>
            ))}
            <Box style={{height:"100px"}}> </Box>
            <Box sx={{
                position: 'fixed',
                bottom: 0,
                left: 0,
                right: 0,
                p: 2,
                borderTop: '1px solid grey',
                backgroundColor: 'white',
                color: '#000'
            }}>
                <Grid container spacing={2} columns={players.length}>
                    {players.map(player => (
                        <Grid item xs={1} key={player}>
                            <Typography variant="h6">{player}</Typography>
                            <Typography variant="body1">{rates[player]} pts.</Typography>
                        </Grid>
                    ))}
                </Grid>
            </Box>
        </Container>
    );
}