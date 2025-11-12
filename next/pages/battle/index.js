import React, {useEffect, useState} from 'react';
import {Box, Button, Container, Grid, Typography} from '@mui/material';
import {StyledTextField} from "../../styles/pik5.css";
import {id2name, rankColor, range, useLocale} from "../../lib/pik5";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import TextField from "@mui/material/TextField";
import DialogActions from "@mui/material/DialogActions";
import prisma from "../../lib/prisma";

const dandoriStages = range(413, 418)
const dandoriPikmins = range(1, 8) // 赤、青、黄、白、紫、羽、岩、氷

function generateRandomHex(length){
    return Math.floor(Math.random() * Math.pow(16, length).toString(16).padStart(length, "0"))
}
const sessionId = generateRandomHex(9)

export async function getStaticProps() {
    // 最新レートを取得
    const res = await fetch(`http://laravel:8000/api/battle/rate`)
    const rate = await res.json()

    // 最新スコアを取得
    const scoreRes = await fetch(`http://laravel:8000/api/battle/score`)
    const score = await scoreRes.json()

    // スクリーンネームをリクエスト
    const users = await prisma.user.findMany({
        select: {
            userId: true,
            name: true
        }
    })

    return {props: {rate, users, score} }
}

export default function Battle(props) {

    const {t} = useLocale()

    const [grids, setGrids] = useState([])
    const [history, setHistory] = useState([])
    const [historyA, setHistoryA] = useState([])
    const [historyB, setHistoryB] = useState([])
    const [count, setCount] = useState(0)
    const [players, setPlayers] = useState([])
    const [rates, setRates] = useState({})
    const [iniRates, setIniRates] = useState({})
    const [prevRates, setPrevRates] = useState({})
    const [borders, setBorders] = useState({})
    const [pool, setPool] = useState(0)
    const [open, setOpen] = useState(false)
    const [newPlayerName, setNewPlayerName] = useState('')

    // 最初に実行するレート取得
    useEffect(() => {
        const fetchPlayerData = async () => {
            try {
                const newPlayers = Object.values(props.rate).map(player => player.user_id)
                const newPlayerRates = Object.values(props.rate).reduce((acc, player) => {
                    acc[player.user_id] = player.result_point
                    return acc
                }, {})

                setPlayers(newPlayers)
                setRates(newPlayerRates) // レートをセット
                setIniRates(newPlayerRates) // 読み込み時のレートを保存

            } catch (error) {
                console.error('Error fetching player data:', error);
            }
        };

        fetchPlayerData()
    }, [])

    const getRandomStages = (stages, pikmins, history, setHistory, historyA, setHistoryA, historyB, setHistoryB) => {
        const allStages = []
        stages.forEach(a => {
            pikmins.forEach(b => {
                allStages.push([a, b])
            })
        })
        const availableStages = allStages.filter(stage => {
            return !history.some(h => h[0] === stage[0] && h[1] === stage[1])
        })
        if (availableStages.length === 0) {
            setHistory([])
            return getRandomStages(stages, pikmins, [], setHistory, historyA, setHistoryA, historyB, setHistoryB)
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
    // セッションを追加するボタン
    const handleButtonClick = () => {
        const [selectedItemA, selectedItemB] = getRandomStages(dandoriStages, dandoriPikmins, history, setHistory, historyA, setHistoryA, historyB, setHistoryB)
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

            // 現在のレートを保存（計算前の状態を保存する）
            const currentRates = latestGrid.players.reduce((acc, player) => {
                acc[player.name] = player.initialRate // 初期レートを保存
                return acc
            }, {})
            setPrevRates(currentRates) // prevRatesに保存

            // 各プレイヤーの貢献度を計算し、プールを更新
            const updatedPlayers = latestGrid.players.map((player) => {
                const contribution = Math.round(player.initialRate / 10); // プールへの支払い
                currentPool += contribution;
                return { ...player, rate: player.initialRate - contribution };
            });
            setPool(currentPool);

            // 順位計算と自然数の和を計算
            const sortedPlayers = [...updatedPlayers].sort((a, b) => b.scoreC - a.scoreC);
            const n = sortedPlayers.length;
            const t = (n * (n + 1)) / 2; // 自然数の和

            // ボーダーラインを計算するためのリストを初期化
            const newBorders = {};

            // 各プレイヤーにおけるリワードと順位のボーダーラインを計算
            updatedPlayers.forEach((player) => {
                const contribution = Math.round(player.initialRate / 10); // 支払い点数
                let borderRank = n + 1; // 初期値として最低順位を設定

                // 各順位でリワードを計算し、比較
                for (let rank = n; rank >= 0; rank--) {
                    const reward = Math.round(((n - rank + 1) / t) * currentPool); // リワード計算
                    if (reward > contribution) {
                        borderRank = rank; // 支払いよりリワードが多ければボーダーラインを更新
                        break; // 最小順位が決まったら終了
                    }
                }
                // 各プレイヤーのボーダーラインを保存
                newBorders[player.name] = borderRank <= n ? borderRank : null; // 有効な順位のみ保存
            });
            // ボーダーラインを保存
            setBorders(newBorders);

            // 各プレイヤーの順位に基づいて報酬を更新
            sortedPlayers.forEach((player, index) => {
                const rank = index + 1; // 順位 (1位が最上位)
                const reward = Math.round(((n - rank + 1) / t) * currentPool); // 新しい計算式
                player.rate += reward; // 報酬を追加
            });

            // 各プレイヤーの最終レートと順位を設定
            const finalPlayers = updatedPlayers.map((player) => ({
                ...player,
                rate: sortedPlayers.find((p) => p.name === player.name).rate,
                rank: sortedPlayers.find((p) => p.name === player.name).rank,
            }));

            // 新しいレートをセット
            const newRates = { ...rates };
            finalPlayers.forEach((player) => {
                newRates[player.name] = player.rate;
            });
            setRates(newRates);

            // 最新のグリッドを更新
            return prevGrids.map((grid, index) => {
                if (index === 0) {
                    return { ...latestGrid, players: finalPlayers };
                }
                return grid;
            })
        })
    }
    // TODO: APIへ送信する処理
    const onSubmit = async (grid) => {
        for (const player of grid.players) {
            const payload = {
                sessionId: sessionId,
                battleId: grid.battleId,
                stageId: grid.itemA,
                itemB: grid.itemB,
                scoreA: player.scoreA,
                scoreB: player.scoreA,
                rank: player.rank,
                initialRate: player.initialRate,
                rate: player.rate,
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
    const handlePlayerClick = (playerName) => {
        setPlayers(players.filter(player => player !== playerName))
        setRates(prevRates => {
            const newRates = {...prevRates}
            delete newRates[playerName]
            return newRates
        })
    }
    const handleAddPlayer = () => {
        setOpen(true)
    }
    const handleClose = () => {
        setOpen(false)
        setNewPlayerName('')
    }
    const handleSavePlayer = () => {
        const trimmedName = newPlayerName.trim()
        if (trimmedName && !players.includes(trimmedName)) {
            const existingPlayer = Object.values(props.rate).find(player => player.user_id === trimmedName)
            const initialRate = existingPlayer ? existingPlayer.result_point : 1000
            setPlayers([...players, trimmedName])
            setRates({ ...rates, [trimmedName]: initialRate })
        }
        handleClose()
    }
    const copyToClipboard = async () => {
        const allTextFields = document.querySelectorAll("input[data-grid-id]");
        const gridData = {};

        allTextFields.forEach((input) => {
            const gridId = input.dataset.gridId;
            const scoreType = input.dataset.scoreType;
            const value = input.value || "0";

            if (!gridData[gridId]) {
                gridData[gridId] = {scoreA: [], scoreB: []};
            }

            gridData[gridId][scoreType].push(value);
        });

        // スコアA → スコアB の順に並べる
        const stageIds = Object.keys(gridData).sort((a, b) => a - b); // ステージ順にソート
        const scoreAList = stageIds.map(id => gridData[id].scoreA.join("\t")).join("\n");
        const scoreBList = stageIds.map(id => gridData[id].scoreB.join("\t")).join("\n");

        const outputText = `${scoreAList}\n\n${scoreBList}`

        async function copyText(text) {
            if (navigator.clipboard && window.isSecureContext) {
                // セキュアコンテキストでは clipboard API を使用
                try {
                    await navigator.clipboard.writeText(text)
                    alert('スコアをクリップボードにコピーしました！')
                    return
                } catch (err) {
                    console.warn('Clipboard API に失敗:', err)
                }
            }

            // フォールバック: 古い方法でコピー
            const textarea = document.createElement('textarea')
            textarea.value = text
            textarea.style.position = 'fixed' // スクロール防止
            textarea.style.opacity = '0'
            document.body.appendChild(textarea)
            textarea.focus()
            textarea.select()

            try {
                const successful = document.execCommand('copy')
                if (successful) {
                    alert('スコアをクリップボードにコピーしました！')
                } else {
                    throw new Error('execCommand に失敗')
                }
            } catch (err) {
                console.error('コピーに失敗しました:', err)
                alert('コピーに失敗しました。手動でコピーしてください。')
            } finally {
                document.body.removeChild(textarea)
            }
        }

        await copyText(outputText)
    }
    return (
        <Container>
            <Typography variant="" className="title">ダンドリバトル大会戦績表</Typography><br/>
            <Typography variant="" className="subtitle">Online Dandori Battle</Typography><br/>
            <details className="info-box">
                <summary><strong>ルール</strong></summary><br/>
                ダンドリバトル大会はピクミン４の「ダンドリバトル（vsCOM）」を同条件で同時にプレイし擬似的なオンライン対戦で競うイベントです。<br/>
                <br/>
                <ul>
                    <li>プレミア品：あり、ハテナカプセル：あり、<strong>逆転バクダン：なし</strong></li>
                    <li>スタートボタン（マップメニュー）は押下禁止。Yボタンメニューは故意の遅延行為を疑われない範囲でなら使用可能</li>
                    <li>みまわしドローンは使用禁止。</li>
                    <li>ハンデ設定は常にノーマル（COMもノーマル）</li>
                    <li>ステージとピクミンは毎回ランダム。ただし、同じ組み合わせは同一セッションの中で一度しか出現しない。セッションは主催が終了処理を行うか48回対戦するとリセットする。</li>
                    <li>「風雲ダンドリ城」で城スタートの場合のみ、開始後10秒以内なら１回までのリスタート（ダンドリバトルを中断→再入場）が許される。</li>
                    <li>各参加者は初参加時に1000点（全総合ランキング初段未満は原則500点。ただし特に希望する場合は1000点）支給され、各対戦開始前に所持ポイントの10分の１をポットに支払う。（小数は四捨五入する。四捨五入の結果が０点でも参加は可能）</li>
                    <li>対戦後、[（自分のダンドリP）-（COMのダンドリP）]をプレイヤーの得点とし、それによって順位づけを行う。</li>
                    <li>各参加者は順位に応じて次の計算によってポイントが還元される。［（参加者数-順位+1) / (1から参加者数までの整数の和) * ポット］</li>
                    <li>同点の場合は該当者がもらえるポイントを等分する。</li>
                </ul>
                <Box style={{margin:"1em",padding:"1.5em",fontSize:"0.9em",border:"1px solid red"}}>
                    <ul>
                        <li>スコア入力は主催が行います。お手数ですが、ゲームが終了したら合図を送るまでリザルト画面を表示したまま待機してください。</li>
                        <li>画面共有時、可能であれば自身のハンドルネームを画面内に表示してください。</li>
                        <li>初参加の場合は、あらかじめローカル対戦用のダンドリバトルを全開放（熱砂の闘技場まで１回ずつプレイ）しておいてください。</li>
                    </ul>
                </Box>
            </details>
            <Button variant="contained" color="primary" onClick={handleButtonClick}>
                セッションを追加
            </Button>
            <Button variant="contained" color="primary" onClick={handleAddPlayer} style={{ marginLeft: 16 }}>
                プレイヤーを追加する
            </Button>
            <Button variant="contained" color="primary" onClick={copyToClipboard} style={{ marginLeft: 16 }}>
                スコアをエクスポート
            </Button>
            {grids.map((grid, gridIndex) => (
                <Box key={grid.id} sx={{ mt: 2, p: 2, border: '1px solid grey' }}>
                    <Typography variant="span">#{grid.id + 1}</Typography><br/>
                    <Typography variant="span" style={{fontSize:"2em"}}>{t.stage[grid.itemA]} × {t.pikmin[grid.itemB]}</Typography>
                    {(() => {
                        const hiScore = props.score?.find(score => score.stage_id === grid.itemA && score.pikmin === grid.itemB);
                        return hiScore ? (
                            <Typography variant="span" style={{border:"1px solid #fff",padding:"0.5em",marginLeft:"3em"}}>大会ベスト: {hiScore.dandori_score} pts （{id2name(props.users, hiScore.user_id)} さん）</Typography>
                        ) : (
                            <Typography variant="span" style={{border:"1px solid #fff",padding:"0.5em",marginLeft:"3em"}}>大会ベスト: -</Typography>
                        );
                    })()}
                    <Button
                        variant="contained"
                        style={{marginLeft:"2em"}}
                        onClick={() => handleScoreSubmit(grid.id)}>
                        レートを計算する
                    </Button>
                    <hr style={{margin:"1em"}}/>
                    <Grid container spacing={2} columns={7} key={grid.id}>
                        {grid.players.map(function(player, playerIndex) {
                                const rankColorStr = rankColor(player.rank < 4 ? player.rank : 4, 0, 1)
                                return (
                                    <Grid item xs={1} key={player.name}>
                                        <Typography variant="span">{id2name(props.users, player.name)}</Typography><br/>
                                        <StyledTextField
                                            type="number"
                                            value={player.scoreA || ""}
                                            inputProps={{ "data-grid-id": grid.id, "data-player-name": player.name, "data-score-type": "scoreA" }}
                                            style={{minWidth: "100px", marginBottom: "10px"}}
                                            onChange={(e) => handleScoreChange(grid.id, player.name, 'scoreA', parseInt(e.target.value, 10) || 0)}
                                            flilWidth
                                        />
                                        <StyledTextField
                                            type="number"
                                            value={player.scoreB || ""}
                                            inputProps={{ "data-grid-id": grid.id, "data-player-name": player.name, "data-score-type": "scoreB" }}
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
                    {players.map(function(player) {
                        // 前回レートと今回レートから増減値を計算
                        const prevReward = prevRates[player] ? (rates[player] - prevRates[player]) : 0
                        const prevRewardStr = prevReward > 0 ? `+${prevReward}` : `${prevReward}`
                        return (
                        <Grid item xs={1} key={player} style={{textAlign:"center"}}>
                            <div style={{backgroundColor:"#333",color:"#eee",borderRadius:"12px",padding:"4px 0",fontSize:"1.1em",cursor:'pointer',fontFamily:"M PLUS 1 CODE !important"}} onClick={() => handlePlayerClick(player)}>{id2name(props.users, player)}</div>
                            <div style={{marginTop:"4px",fontFamily:"Proza Libre"}}>{rates[player]}<span style={{fontSize:"0.8em",color:"#777"}}> / {iniRates[player]}</span></div>
                            <div style={{fontSize:"0.85em"}}>{prevReward ? `(${prevRewardStr})` : ""} {borders[player] ? `→BEP：${borders[player]}位` : ""}</div>
                        </Grid>
                    )})}
                </Grid>
            </Box>
            <Dialog open={open} onClose={handleClose}>
                <DialogTitle>追加するプレイヤーのIDを入力してください</DialogTitle>
                <DialogContent>
                    <TextField
                        autoFocus
                        margin="dense"
                        label="Player Name"
                        type="text"
                        fullWidth
                        value={newPlayerName}
                        onChange={(e) => setNewPlayerName(e.target.value)}
                    />
                </DialogContent>
                <DialogActions>
                    <Button onClick={handleClose} color="primary">
                        Cancel
                    </Button>
                    <Button onClick={handleSavePlayer} color="primary">
                        Save
                    </Button>
                </DialogActions>
            </Dialog>
        </Container>
    );
}