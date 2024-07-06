// pages/index.js
import React, {useState} from 'react';
import {Box, Button, Container, Grid, TextField, Typography} from '@mui/material';
import {StyledTextField} from "../../styles/pik5.css";

const arrayA = ["こてしらべの戦い", "戦場のおもちゃ箱", "風雲ダンドリ城", "決戦のオアシス", "熱砂の決闘場", "最果ての闘技場"];
const arrayB = ["赤ピクミン", "黄ピクミン", "青ピクミン", "岩ピクミン", "羽ピクミン", "紫ピクミン", "白ピクミン", "氷ピクミン"]
const players = ["プレイヤー１", "プレイヤー２", "プレイヤー３", "プレイヤー４"]

export default function Home() {
    const [grids, setGrids] = useState([]);
    const [historyA, setHistoryA] = useState([]);
    const [historyB, setHistoryB] = useState([]);
    const [count, setCount] = useState(0);

    const getRandomItem = (array, history, setHistory) => {
        const availableItems = array.filter(item => !history.includes(item));

        if (availableItems.length === 0) {
            setHistory([]);
            return getRandomItem(array, [], setHistory);
        } else {
            const randomIndex = Math.floor(Math.random() * availableItems.length);
            const selectedItem = availableItems[randomIndex];
            // 直近３回で出現したステージは再出現しない（slice(0, 3)の部分）
            const newHistory = [selectedItem, ...history].slice(0, 3);
            setHistory(newHistory);
            return selectedItem;
        }
    };

    const handleButtonClick = () => {
        const selectedItemA = getRandomItem(arrayA, historyA, setHistoryA);
        const selectedItemB = getRandomItem(arrayB, historyB, setHistoryB);

        const newGrid = {
            id: count,
            itemA: selectedItemA,
            itemB: selectedItemB,
            players: players.map(player => ({
                name: player,
                scoreA: 0,
                scoreB: 0,
                scoreC: 0,
                rank: 1,
            }))
        };

        setGrids([newGrid, ...grids]);
        setCount(count + 1);
    };

    const handleScoreChange = (gridId, playerName, field, value) => {
        setGrids(prevGrids => {
            return prevGrids.map(grid => {
                if (grid.id === gridId) {
                    const updatedPlayers = grid.players.map(player => {
                        if (player.name === playerName) {
                            const updatedPlayer = {...player, [field]: value};
                            updatedPlayer.scoreC = updatedPlayer.scoreA - updatedPlayer.scoreB;
                            return updatedPlayer;
                        }
                        return player;
                    });

                    // Calculate ranks without changing player order
                    const sortedPlayers = [...updatedPlayers].sort((a, b) => b.scoreC - a.scoreC);
                    sortedPlayers.forEach((player, index, array) => {
                        player.rank = index + 1;
                        if (index > 0 && player.scoreC === array[index - 1].scoreC) {
                            player.rank = array[index - 1].rank;
                        }
                    });

                    return {
                        ...grid, players: updatedPlayers.map(player => ({
                            ...player,
                            rank: sortedPlayers.find(p => p.name === player.name).rank
                        }))
                    };
                }
                return grid;
            });
        });
    };

    return (
        <Container>
            <Button variant="contained" color="primary" onClick={handleButtonClick}>
                Add Session
            </Button>
            {grids.map((grid, gridIndex) => (
                <Box key={grid.id} sx={{ mt: 2, p: 2, border: '1px solid grey' }}>
                    <Typography variant="h6">#{grid.id + 1}</Typography>
                    <Typography variant="body1">{grid.itemA} - {grid.itemB}</Typography>
                    <Grid container spacing={2}>
                        {grid.players.map((player, playerIndex) => (
                            <Grid item xs={3} key={player.name}>
                                <Typography variant="h6">{player.name}</Typography>
                                <StyledTextField
                                    type="number"
                                    value={player.scoreA}
                                    style={{marginBottom:"20px"}}
                                    onChange={(e) => handleScoreChange(grid.id, player.name, 'scoreA', parseInt(e.target.value, 10) || 0)}
                                    fullWidth
                                />
                                <StyledTextField
                                    type="number"
                                    value={player.scoreB}
                                    onChange={(e) => handleScoreChange(grid.id, player.name, 'scoreB', parseInt(e.target.value, 10) || 0)}
                                    fullWidth
                                />
                                <Typography variant="body1">リザルト: {player.scoreC} pts. ({player.rank} 位)</Typography>
                            </Grid>
                        ))}
                    </Grid>
                </Box>
            ))}
        </Container>
    );
}