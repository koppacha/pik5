import {useEffect, useMemo, useState} from 'react'
import {Box, Button, Checkbox, Dialog, DialogTitle, ToggleButton, ToggleButtonGroup, Typography, useMediaQuery} from '@mui/material'
import {StyledDialogContent} from '../../styles/pik5.css'

const selectionSteps = ['全チェック', 'カギのみ', '全解除']

export default function TreasureSimulator({open, onClose, stageId, stageName, treasures, displayedTotal}) {
    const fullScreen = useMediaQuery('(max-width:600px)')
    const [region, setRegion] = useState('jp')
    const items = useMemo(() => treasures.flatMap(treasure =>
        Array.from({length: treasure.quantity}, (_, index) => ({
            key: `${treasure.legacy_object_id}-${index}`,
            floor: treasure.floor,
            name: treasure.object_name,
            value: treasure.value,
            value_na: treasure.value_na,
            value_eu: treasure.value_eu,
            weight_jp: treasure.weight_jp,
            weight_na: treasure.weight_na,
            weight_eu: treasure.weight_eu
        }))
    ), [treasures])
    const [selected, setSelected] = useState(() => new Set(items.map(item => item.key)))
    const [nextSelectionStep, setNextSelectionStep] = useState(0)

    useEffect(() => {
        setSelected(new Set(items.map(item => item.key)))
        setNextSelectionStep(0)
    }, [items, stageId])

    const floors = useMemo(() => {
        const grouped = new Map()
        items.forEach(item => {
            if (!grouped.has(item.floor)) grouped.set(item.floor, [])
            grouped.get(item.floor).push(item)
        })
        return [...grouped.entries()]
    }, [items])
    const regionalValue = item => item[`value_${region}`] ?? item.value
    const regionalWeight = item => item[`weight_${region}`] ?? item.weight_jp
    const total = items.reduce((sum, item) => sum + (selected.has(item.key) ? regionalValue(item) : 0), 0)
    const sourceTotal = items.reduce((sum, item) => sum + item.value, 0)
    const regionButtonStyle = value => ({
        textTransform: 'none',
        color: region === value ? 'var(--color-bg-base)' : 'var(--color-text-base)',
        backgroundColor: region === value ? 'var(--color-text-base)' : 'transparent',
        borderColor: 'var(--color-text-base)'
    })

    const toggle = key => {
        setSelected(current => {
            const next = new Set(current)
            if (next.has(key)) next.delete(key)
            else next.add(key)
            return next
        })
    }
    const cycleSelection = () => {
        let nextItems = []
        if (nextSelectionStep === 0) nextItems = items
        if (nextSelectionStep === 1) nextItems = items.filter(item => item.name === 'あのカギ')
        setSelected(new Set(nextItems.map(item => item.key)))
        setNextSelectionStep(current => (current + 1) % selectionSteps.length)
    }

    return (
        <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm" fullScreen={fullScreen} aria-labelledby="treasure-simulator-title">
            <StyledDialogContent style={{display: 'flex', flexDirection: 'column', padding: 0, maxHeight: fullScreen ? '100%' : '80vh'}}>
                <DialogTitle id="treasure-simulator-title">お宝価値シミュレーター</DialogTitle>
                <Box style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 20px 12px', gap: 8, flexWrap: 'wrap'}}>
                    <Typography variant="body2" style={{fontWeight: 700, fontSize: '1.2em'}}>{stageName}</Typography>
                    <Button variant="contained" onClick={cycleSelection} disabled={items.length === 0}>
                        {selectionSteps[nextSelectionStep]}
                    </Button>
                </Box>
                <ToggleButtonGroup value={region} exclusive onChange={(event, value) => value && setRegion(value)} size="small" aria-label="お宝の地域版" style={{padding: '0 20px 12px', alignSelf: 'flex-start', flexWrap: 'wrap'}}>
                    <ToggleButton value="jp" style={regionButtonStyle('jp')}>JP (NGC / Wii)</ToggleButton>
                    <ToggleButton value="na" style={regionButtonStyle('na')}>NA (Switch)</ToggleButton>
                    <ToggleButton value="eu" style={regionButtonStyle('eu')}>EU</ToggleButton>
                </ToggleButtonGroup>
                {region === 'jp' && sourceTotal !== Number(displayedTotal) &&
                    <Typography variant="body2" style={{padding: '0 20px 12px'}}>
                        元データの合計は{sourceTotal.toLocaleString()}ポコです。画面の表示値とは{Math.abs(sourceTotal - Number(displayedTotal))}ポコ異なります。
                    </Typography>
                }
                <Box style={{overflowY: 'auto', flex: 1, padding: '0 20px'}}>
                    {floors.map(([floor, floorItems]) => (
                        <Box key={floor} style={{marginBottom: 20}}>
                            <Typography variant="subtitle1" style={{fontWeight: 700, marginBottom: 4}}>{floor}F</Typography>
                            {floorItems.map(item => (
                                <label key={item.key} style={{display: 'flex', alignItems: 'center', minHeight: 40, cursor: 'pointer', gap: 4}}>
                                    <Checkbox checked={selected.has(item.key)} onChange={() => toggle(item.key)} inputProps={{'aria-label': `${floor}F ${item.name} ${regionalValue(item)}ポコ 重さ${regionalWeight(item) ?? '不明'}`}} style={{padding: 8}} />
                                    <span style={{flex: 1, overflowWrap: 'anywhere'}}>{item.name}</span>
                                    <span style={{whiteSpace: 'nowrap', marginLeft: 8, textAlign: 'right'}}>{regionalValue(item).toLocaleString()} ポコ / 重さ {regionalWeight(item) ?? '—'}</span>
                                </label>
                            ))}
                        </Box>
                    ))}
                </Box>
                <Box style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 20px', borderTop: '1px solid currentColor', gap: 12}}>
                    <Button onClick={onClose}>閉じる</Button>
                    <Typography aria-live="polite" style={{fontWeight: 700, textAlign: 'right'}}>合計：{total.toLocaleString()} ポコ</Typography>
                </Box>
            </StyledDialogContent>
        </Dialog>
    )
}
