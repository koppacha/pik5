import React, {useEffect, useMemo, useRef, useState} from "react"
import useSWR from "swr"
import {Box, FormControl, MenuItem, Select, Switch} from "@mui/material"
import {basePoints, stageCounts} from "../../lib/const"
import {currentYear, fetcher, id2name, rankColor, useLocale} from "../../lib/pik5"
import NowLoading from "../NowLoading"

const historyRules = [0, 10, 11, 20, 21, 22, 23, 24, 25, 29, 30, 31, 32, 33, 35, 36, 40, 41, 42, 43, 44, 45, 46, 47]
const lineColors = ["#2f7ed8", "#5b8f22", "#8e5ea2", "#f28e2b", "#6b7280"]
const chartLineShadowPlugin = {
    id: "chartLineShadow",
    beforeDatasetDraw(chart) {
        const {ctx} = chart
        ctx.save()
        ctx.shadowColor = "rgba(0, 0, 0, 0.55)"
        ctx.shadowBlur = 8
        ctx.shadowOffsetX = 0
        ctx.shadowOffsetY = 3
    },
    afterDatasetDraw(chart) {
        chart.ctx.restore()
    },
}
const chartNoDataPlugin = {
    id: "chartNoData",
    afterDraw(chart) {
        if (!chart.options.plugins?.noData?.enabled) return
        const {ctx, chartArea} = chart
        if (!chartArea) return
        ctx.save()
        ctx.fillStyle = chart.options.plugins.noData.color
        ctx.font = "14px 'M PLUS 1 CODE', sans-serif"
        ctx.textAlign = "center"
        ctx.textBaseline = "middle"
        ctx.fillText("表示できるデータがありません", (chartArea.left + chartArea.right) / 2, (chartArea.top + chartArea.bottom) / 2)
        ctx.restore()
    },
}

function cssColor(value) {
    if (typeof window === "undefined" || !value?.startsWith("var(")) return value
    const name = value.slice(4, -1).trim()
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || value
}

function latestRankItem(items) {
    return [...items].reverse().find(item => item.rank !== null || item.rps !== null)
}

export default function RankPointHistoryChart({user, users}) {
    const {t} = useLocale()
    const [rule, setRule] = useState(0)
    const [year, setYear] = useState(currentYear())
    const [showRivals, setShowRivals] = useState(false)
    const chartRef = useRef(null)
    const canvasRef = useRef(null)
    const userId = user?.id
    const {data} = useSWR(userId ? `/api/server/user/rps-history/${userId}/${rule}?rivals=${showRivals ? 1 : 0}&year=${year}` : null, fetcher)
    const payload = data?.data
    const current = currentYear()
    const minYear = current % 2 === 0 ? 2016 : 2017
    const yearOptions = Array.from({length: Math.floor((current - minYear) / 2) + 1}, (_, index) => current - (index * 2))

    const chartData = useMemo(() => {
        const series = payload?.series ?? []
        const labels = series[0]?.items?.map(item => item.label) ?? []
        const displayColorOrder = [...series]
            .sort((a, b) => {
                const aItem = latestRankItem(a.items)
                const bItem = latestRankItem(b.items)
                const aRank = aItem?.rank ?? Number.MAX_SAFE_INTEGER
                const bRank = bItem?.rank ?? Number.MAX_SAFE_INTEGER
                if (aRank !== bRank) return aRank - bRank
                return (bItem?.rps ?? -1) - (aItem?.rps ?? -1)
            })
            .map(entry => entry.user)
        const datasets = series.map((entry, index) => ({
            label: id2name(users, entry.user),
            data: entry.items.map(item => item.rps),
            borderColor: showRivals ? rankColor(displayColorOrder.indexOf(entry.user) + 1, 0, 1) : lineColors[index % lineColors.length],
            backgroundColor: "rgba(0,0,0,0)",
            borderWidth: entry.user === userId ? 3 : 2,
            pointRadius: entry.user === userId ? 3 : 2,
            tension: 0.25,
            spanGaps: true,
        }))

        const ownLatest = [...(series.find(entry => entry.user === userId)?.items ?? [])]
            .reverse()
            .find(item => item.rps !== null)
        const ownValues = (series.find(entry => entry.user === userId)?.items ?? [])
            .map(item => Number(item.rps))
            .filter(Number.isFinite)
        const ownMax = ownValues.length ? Math.max(...ownValues) : null
        const ownMin = ownValues.length ? Math.min(...ownValues) : null
        const ownRange = ownMax !== null && ownMin !== null ? ownMax - ownMin : 0
        const latestYear = payload?.latest?.year
        const stageCnt = stageCounts[currentYear()]
        const cls = basePoints.findLastIndex(base => ownLatest?.rps >= stageCnt * base)
        const nextBorder = cls >= 0 ? basePoints[cls + 1] * stageCnt : null
        const borderDistance = ownMax !== null && nextBorder !== null ? nextBorder - ownMax : null
        const shouldShowBorder = borderDistance !== null && borderDistance < Math.max(ownRange * 2, 1)

        if (
            rule === 0 &&
            labels.length > 0 &&
            latestYear === currentYear() &&
            ownLatest?.rps !== null &&
            cls >= 0 &&
            cls < 14 &&
            Number.isFinite(nextBorder) &&
            shouldShowBorder
        ) {
            datasets.push({
                label: t.classes[cls + 1],
                data: labels.map(() => nextBorder),
                borderColor: "#e81fc1",
                borderDash: [6, 5],
                borderWidth: 2,
                pointRadius: 0,
                fill: false,
            })
        }

        const numericValues = datasets
            .flatMap(dataset => dataset.data)
            .filter(value => Number.isFinite(Number(value)))
            .map(Number)
        const axisMaxValue = numericValues.length ? Math.max(...numericValues) : null
        const axisMinValue = numericValues.length ? Math.min(...numericValues) : null
        const axisDiff = axisMaxValue !== null && axisMinValue !== null ? axisMaxValue - axisMinValue : 0
        const axisPadding = axisDiff > 0 ? axisDiff / 20 : Math.max(1, (axisMaxValue ?? 0) / 20)
        const axis = axisMaxValue !== null && axisMinValue !== null
            ? {
                min: Math.max(0, Math.floor(axisMinValue - axisPadding)),
                max: Math.ceil(axisMaxValue + axisPadding),
            }
            : {}

        return {labels, datasets, axis, hasData: numericValues.length > 0}
    }, [payload, rule, showRivals, t.classes, userId, users])

    useEffect(() => {
        let cancelled = false

        async function renderChart() {
            if (!canvasRef.current || chartData.labels.length === 0) return
            const {Chart, LineController, LineElement, PointElement, LinearScale, CategoryScale, Tooltip, Legend} = await import("chart.js")
            Chart.register(LineController, LineElement, PointElement, LinearScale, CategoryScale, Tooltip, Legend, chartLineShadowPlugin, chartNoDataPlugin)
            if (cancelled) return

            const frontColor = cssColor("var(--color-chart-axis-label)")
            const chartDataForCanvas = {
                labels: chartData.labels,
                datasets: chartData.datasets.map(dataset => ({
                    ...dataset,
                    borderColor: cssColor(dataset.borderColor),
                })),
            }

            chartRef.current?.destroy()
            chartRef.current = new Chart(canvasRef.current, {
                type: "line",
                data: chartDataForCanvas,
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    interaction: {mode: "index", intersect: false},
                    plugins: {
                        legend: {
                            labels: {boxWidth: 18, color: frontColor},
                        },
                        noData: {
                            enabled: !chartData.hasData,
                            color: frontColor,
                        },
                    },
                    scales: {
                        x: {
                            grid: {display: false},
                            ticks: {color: frontColor, maxRotation: 0, autoSkip: true, maxTicksLimit: 8},
                            border: {display: false},
                        },
                        y: {
                            min: chartData.axis.min,
                            max: chartData.axis.max,
                            grid: {display: false},
                            border: {display: false},
                            ticks: {
                                color: frontColor,
                                callback: value => Number(value).toLocaleString(),
                            },
                        },
                    },
                },
            })
        }

        renderChart()
        return () => {
            cancelled = true
            chartRef.current?.destroy()
            chartRef.current = null
        }
    }, [chartData])

    return (
        <Box style={{marginTop: "1.5em"}}>
            <Box style={{display: "flex", gap: "12px", alignItems: "center", flexWrap: "wrap", marginBottom: "8px"}}>
                <FormControl size="small" style={{minWidth: "220px"}}>
                    <Select
                        className="styled-select"
                        labelId="rps-history-rule-label"
                        label="ルール"
                        value={rule}
                        onChange={event => setRule(Number(event.target.value))}
                    >
                        {historyRules.map(ruleId => (
                            <MenuItem key={ruleId} value={ruleId}>
                                {ruleId === 0 ? "全総合ランキング" : t.subtitle[ruleId] || t.stage[ruleId] || ruleId}
                            </MenuItem>
                        ))}
                    </Select>
                </FormControl>
                <FormControl size="small" style={{minWidth: "120px"}}>
                    <Select
                        className="styled-select"
                        value={year}
                        onChange={event => setYear(Number(event.target.value))}
                    >
                        {yearOptions.map(option => (
                            <MenuItem key={option} value={option}>{option}</MenuItem>
                        ))}
                    </Select>
                </FormControl>
                <Box style={{display: "flex", alignItems: "center", gap: "4px", fontSize: "0.9em"}}>
                    ライバル
                    <Switch checked={showRivals} onChange={event => setShowRivals(event.target.checked)} />
                </Box>
            </Box>
            <Box style={{height: "280px", position: "relative"}}>
                {!payload ? <NowLoading /> : chartData.labels.length === 0 ? "月次データがありません" : <canvas ref={canvasRef} />}
            </Box>
        </Box>
    )
}
