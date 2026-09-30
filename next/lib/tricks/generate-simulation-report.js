const fs = require('fs')
const path = require('path')

const outputsDir = path.resolve(__dirname, '../../../lab/outputs')
const reportPath = path.resolve(__dirname, '../../pages/limited/tricks/simulation-report.html')
const intervalMinutes = 30

const readJson = filePath => JSON.parse(fs.readFileSync(filePath, 'utf8'))

const readJsonLines = filePath => fs.readFileSync(filePath, 'utf8')
  .split('\n')
  .filter(Boolean)
  .map(line => JSON.parse(line))

const total = (values, key) => values.reduce((sum, item) => sum + Number(item[key] || 0), 0)

const compactState = (entry, minute = Number(entry.minute || 0)) => {
  const players = entry.state.players || []
  const fields = Array.isArray(entry.state.fields) ? entry.state.fields : []
  const totalRewards = fields.reduce((sum, card) => {
    if (Number.isFinite(Number(card.total_reward_points))) return sum + Number(card.total_reward_points)
    const base = Number(card.stack_count || 0) + Number(card.paid_points_total || 0)
    if (Number(card.posters || 0) === 1) return sum + base
    return sum + base + Number(card.difficulty || 1) * Math.floor(base / 5)
  }, 0)

  return {
    minute,
    timestamp: entry.timestamp,
    participants: players.filter(player => player.status !== 'not_joined').length,
    points: total(players, 'points'),
    rankPoints: total(players, 'rank_points'),
    totalRewards,
    hands: total(players, 'hand_count'),
    deck: Number(entry.state.deck_count || 0),
    trash: Number(entry.state.trash_count || 0),
    fields: fields.length,
    collected: Number(entry.state.collected_count || 0)
  }
}

const sampleTimeline = (entries, startAt) => {
  const stateEntries = entries.filter(entry => entry.state && Array.isArray(entry.state.players))
  const buckets = new Map()
  const points = new Map()

  if (!stateEntries.length) return []

  const lastMinute = Number(stateEntries[stateEntries.length - 1].minute || 0)
  const first = stateEntries[0]
  points.set(0, {
    minute: 0,
    timestamp: startAt,
    participants: 0,
    points: 0,
    rankPoints: 0,
    totalRewards: 0,
    hands: 0,
    deck: Number(first.state.deck_count || 0),
    trash: 0,
    fields: 0,
    collected: 0
  })

  stateEntries.forEach(entry => {
    const bucket = Math.floor(Number(entry.minute || 0) / intervalMinutes)
    buckets.set(bucket, entry)
  })

  buckets.forEach((entry, bucket) => {
    const sampledMinute = Math.min((bucket + 1) * intervalMinutes, lastMinute)
    points.set(sampledMinute, compactState(entry, sampledMinute))
  })

  return [...points.values()].sort((left, right) => left.minute - right.minute)
}

const eventCounts = entries => entries.reduce((counts, entry) => {
  if (entry.type === 'event' && entry.event) {
    counts[entry.event] = (counts[entry.event] || 0) + 1
    if (entry.event === 'take' && entry.details?.trigger === 'take_close_attempt') {
      counts.take_close_attempt = (counts.take_close_attempt || 0) + 1
    }
  }
  return counts
}, {})

const summarizePersonalities = players => {
  const groups = new Map()

  players.filter(player => player.joined).forEach(player => {
    const key = player.personality || '未分類'
    const group = groups.get(key) || { name: key, players: 0, points: 0, rankPoints: 0 }
    group.players += 1
    group.points += Number(player.points || 0)
    group.rankPoints += Number(player.rank_points || 0)
    groups.set(key, group)
  })

  return [...groups.values()].map(group => ({
    ...group,
    averagePoints: Math.round(group.points / group.players * 10) / 10,
    averageRankPoints: Math.round(group.rankPoints / group.players * 10) / 10
  }))
}

const summarizeFinalPlayers = players => [...players]
  .sort((left, right) => (
    Number(right.rank_points || 0) - Number(left.rank_points || 0)
    || Number(right.points || 0) - Number(left.points || 0)
    || String(left.name).localeCompare(String(right.name))
  ))
  .map(player => ({
    name: player.name,
    points: Number(player.points || 0),
    rankPoints: Number(player.rank_points || 0),
    draws: Number(player.actions?.draw || 0),
    takes: Number(player.actions?.take || 0),
    scorePosts: Number(player.actions?.initial_post || 0) + Number(player.actions?.update || 0)
  }))

const summarizeCollectedCards = entries => {
  const cards = new Map()
  const getCard = cardId => {
    if (!cards.has(cardId)) {
      cards.set(cardId, { cardId, participants: new Set(), scorePosts: 0 })
    }
    return cards.get(cardId)
  }

  entries.forEach(entry => {
    if (entry.type !== 'event' || !entry.details) return
    const cardId = Number(entry.details.card_id)
    if (!Number.isFinite(cardId)) return
    const card = getCard(cardId)
    if (entry.event === 'draw') {
      card.rarity = Number(entry.details.rarity || 0)
      card.difficulty = Number(entry.details.difficulty || 0)
    } else if (entry.event === 'take') {
      card.takenAt = entry.timestamp
      card.stackCount = Number(entry.details.stack_count || 0)
    } else if (entry.event === 'initial_post' || entry.event === 'update') {
      card.scorePosts += 1
      if (entry.actor) card.participants.add(entry.actor)
    } else if (entry.event === 'collect') {
      card.collectedAt = entry.timestamp
      card.totalRewardPoints = Number(entry.details.rewards?.total_reward || 0)
    }
  })

  return [...cards.values()]
    .filter(card => card.collectedAt)
    .sort((left, right) => new Date(left.collectedAt) - new Date(right.collectedAt))
    .map(card => ({
      cardId: card.cardId,
      fieldMinutes: card.takenAt ? Math.max(0, Math.round((new Date(card.collectedAt) - new Date(card.takenAt)) / 60000)) : 0,
      scorePosts: card.scorePosts,
      participants: card.participants.size,
      rarity: card.rarity || 0,
      difficulty: card.difficulty || 0,
      stackCount: card.stackCount || 0,
      totalRewardPoints: card.totalRewardPoints
    }))
}

const files = fs.readdirSync(outputsDir)
  .filter(file => /^tricks_simulation_\d{8}_\d{6}(?:_\d{6})?_summary\.json$/.test(file))
  .sort()
  .reverse()

if (!files.length) {
  throw new Error(`シミュレーション概要が見つかりません: ${outputsDir}`)
}

const logs = files.map(summaryFile => {
  const id = summaryFile.replace('_summary.json', '')
  const jsonlFile = `${id}.jsonl`
  const summary = readJson(path.join(outputsDir, summaryFile))
  const entries = readJsonLines(path.join(outputsDir, jsonlFile))
  const players = (summary.players || []).filter(player => player.joined)
  const finalPlayers = summarizeFinalPlayers(players)

  return {
    id,
    generatedAt: id.replace('tricks_simulation_', ''),
    source: { summary: summaryFile, timeline: jsonlFile },
    startAt: summary.start_at,
    endAt: summary.end_at,
    seed: summary.seed,
    eventsWritten: summary.events_written,
    collections: summary.collections,
    subsidyPayments: summary.subsidy_payments,
    policy: summary.policy || null,
    drawTax: summary.draw_tax || null,
    rarityDrawCounts: summary.rarity_draw_counts || null,
    invariantErrors: summary.invariant_errors || [],
    fixedRewardTests: summary.fixed_reward_tests || [],
    fixedRarityTests: summary.fixed_rarity_tests || [],
    fixedRankPointTests: summary.fixed_rank_point_tests || [],
    fixedPredictionTests: summary.fixed_prediction_tests || [],
    fixedTimeModelTests: summary.fixed_time_model_tests || [],
    fixedEntryRuleTests: summary.fixed_entry_rule_tests || [],
    fixedCountdownTests: summary.fixed_countdown_tests || [],
    fixedHolderTests: summary.fixed_holder_tests || [],
    fixedTakeCooldownTests: summary.fixed_take_cooldown_tests || [],
    final: {
      participants: players.length,
      points: total(players, 'points'),
      rankPoints: total(players, 'rank_points'),
      deck: summary.deck_count,
      trash: summary.trash_count,
      fields: summary.field_count,
      collected: summary.collected_count
    },
    leaders: [...players]
      .sort((left, right) => Number(right.rank_points || 0) - Number(left.rank_points || 0))
      .slice(0, 3)
      .map(player => ({ name: player.name, rankPoints: player.rank_points, points: player.points })),
    finalPlayers,
    collectedCards: summarizeCollectedCards(entries),
    personalities: summarizePersonalities(players),
    eventCounts: eventCounts(entries),
    timeline: sampleTimeline(entries, summary.start_at)
  }
})

const dataJson = JSON.stringify(logs).replace(/</g, '\\u003c')

const html = `<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <link rel="icon" href="data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 32 32%22><text y=%2226%22 font-size=%2226%22>♠</text></svg>">
  <title>Trick Taking Simulation Report</title>
  <style>
    :root {
      color-scheme: dark;
      --bg: #071019;
      --panel: #101d28;
      --panel-2: #142634;
      --line: #2a3c49;
      --text: #f4f7f8;
      --muted: #9eb0ba;
      --accent: #53d6b5;
      --warning: #ffbe55;
      --danger: #ff758a;
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }

    * { box-sizing: border-box }
    body { margin: 0; background: radial-gradient(circle at 10% -10%, #183749 0, transparent 35rem), var(--bg); color: var(--text) }
    button { font: inherit }
    .shell { width: min(1600px, 100%); margin: 0 auto; padding: 32px clamp(16px, 3vw, 48px) 64px }
    .eyebrow { margin: 0 0 8px; color: var(--accent); font-size: 12px; font-weight: 800; letter-spacing: .14em; text-transform: uppercase }
    h1 { margin: 0; font-size: clamp(28px, 4vw, 52px); letter-spacing: -.04em }
    h2 { margin: 0; font-size: 20px }
    .lede { max-width: 760px; margin: 12px 0 24px; color: var(--muted); line-height: 1.7 }
    .tabs { display: flex; gap: 8px; overflow-x: auto; padding: 4px 0 16px }
    .tab { flex: 0 0 auto; padding: 10px 14px; border: 1px solid var(--line); border-radius: 999px; background: rgba(16,29,40,.75); color: var(--muted); cursor: pointer }
    .tab[aria-selected="true"] { border-color: var(--accent); background: var(--accent); color: #05271f; font-weight: 800 }
    .meta { display: flex; flex-wrap: wrap; gap: 8px 16px; margin: 4px 0 20px; color: var(--muted); font-size: 13px }
    .grid { display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); gap: 12px }
    .metric, .panel { border: 1px solid var(--line); background: linear-gradient(160deg, rgba(20,38,52,.96), rgba(11,23,32,.96)); box-shadow: 0 18px 50px rgba(0,0,0,.16) }
    .metric { min-height: 112px; padding: 18px; border-radius: 16px }
    .metric-label { color: var(--muted); font-size: 12px }
    .metric-value { margin-top: 8px; font-size: 30px; font-weight: 850; letter-spacing: -.04em }
    .metric-note { margin-top: 4px; color: var(--muted); font-size: 12px }
    .status-ok { color: var(--accent) }
    .status-error { color: var(--danger) }
    .panel { margin-top: 14px; padding: 20px; border-radius: 18px }
    .panel-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; margin-bottom: 16px }
    .panel-copy { margin: 4px 0 0; color: var(--muted); font-size: 13px }
    .chart { width: 100%; min-height: 320px; overflow: hidden }
    .chart svg { display: block; width: 100%; height: 320px }
    .chart text { fill: var(--muted); font-size: 11px }
    .chart .grid-line { stroke: var(--line); stroke-width: 1 }
    .chart .series-line { fill: none; stroke-width: 2.5; vector-effect: non-scaling-stroke }
    .legend { display: flex; flex-wrap: wrap; gap: 8px 16px; color: var(--muted); font-size: 12px }
    .legend span { display: inline-flex; align-items: center; gap: 7px }
    .swatch { width: 20px; height: 3px; border-radius: 9px }
    .panel-tools { display: flex; align-items: center; justify-content: flex-end; flex-wrap: wrap; gap: 10px 16px }
    .series-toggle { padding: 7px 11px; border: 1px solid var(--line); border-radius: 9px; background: rgba(255,255,255,.04); color: var(--text); cursor: pointer }
    .series-toggle:hover, .series-toggle:focus-visible { border-color: var(--accent); outline: none }
    .series-toggle[aria-pressed="true"] { color: var(--accent); border-color: var(--accent) }
    .overview { display: grid; grid-template-columns: 1fr 1fr; gap: 14px }
    .rank-list, .personality-list { display: grid; gap: 8px; margin-top: 14px }
    .rank-row, .personality-row { display: grid; align-items: center; gap: 12px; padding: 11px 12px; border-radius: 10px; background: rgba(255,255,255,.035) }
    .rank-row { grid-template-columns: 30px 1fr auto }
    .personality-row { grid-template-columns: 1fr repeat(3, auto) }
    .rank-number { color: var(--accent); font-weight: 850 }
    .subtle { color: var(--muted); font-size: 12px }
    .table-wrap { width: 100%; margin-top: 14px; overflow-x: auto }
    .data-table { width: 100%; min-width: 720px; border-collapse: collapse; font-size: 13px }
    .data-table th, .data-table td { padding: 10px 12px; border-bottom: 1px solid var(--line); white-space: nowrap; text-align: right }
    .data-table th { color: var(--muted); font-size: 11px; font-weight: 700; letter-spacing: .04em }
    .data-table th:first-child, .data-table td:first-child { text-align: left }
    .data-table tbody tr:hover { background: rgba(255,255,255,.035) }
    .data-table .rank-cell { color: var(--accent); font-weight: 800 }
    .stars { color: var(--warning); letter-spacing: .05em }
    .events { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 14px }
    .event-chip { padding: 7px 10px; border: 1px solid var(--line); border-radius: 999px; color: var(--muted); font-size: 12px }
    .event-chip b { color: var(--text) }
    .footnote { margin: 16px 0 0; color: var(--muted); font-size: 12px; line-height: 1.6 }
    .empty { padding: 24px; color: var(--muted); text-align: center }

    @media (max-width: 1000px) {
      .grid { grid-template-columns: repeat(3, minmax(0, 1fr)) }
      .overview { grid-template-columns: 1fr }
    }

    @media (max-width: 620px) {
      .shell { padding-top: 22px }
      .grid { grid-template-columns: repeat(2, minmax(0, 1fr)) }
      .metric { min-height: 96px; padding: 14px }
      .metric-value { font-size: 25px }
      .panel { padding: 14px }
      .panel-head { flex-direction: column }
      .panel-tools { width: 100%; justify-content: flex-start }
      .chart, .chart svg { min-height: 280px; height: 280px }
      .personality-row { grid-template-columns: 1fr auto }
      .personality-row span:nth-child(3), .personality-row span:nth-child(4) { display: none }
    }
  </style>
</head>
<body>
  <main class="shell">
    <p class="eyebrow">Limited Trick / Rule Simulation</p>
    <h1>シミュレーション結果</h1>
    <p class="lede">48時間の大会進行を30分間隔に集約し、カード循環とプレイヤー経済の変化を比較します。最新の生成ログを初期表示しています。</p>
    <nav id="tabs" class="tabs" role="tablist" aria-label="シミュレーションログ"></nav>
    <section id="report" aria-live="polite"></section>
  </main>

  <script id="simulation-data" type="application/json">${dataJson}</script>
  <script>
    const logs = JSON.parse(document.getElementById('simulation-data').textContent)
    const tabs = document.getElementById('tabs')
    const report = document.getElementById('report')
    const colors = ['#53d6b5', '#68a8ff', '#ffbe55', '#ff758a', '#c88cff']
    const eventLabels = {
      join: '参加', draw: 'ドロー', take: 'テイク', initial_post: '初投稿',
      update: '更新', practice: '練習', subsidy: '給付', collect: '回収', wait: '待機',
      take_close_attempt: '締切前テイク試行', final: '終了'
    }

    const escapeHtml = value => String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;')

    const generatedLabel = value => {
      const match = value.match(/^(\\d{4})(\\d{2})(\\d{2})_(\\d{2})(\\d{2})(\\d{2})$/)
      return match ? \`${'${match[1]}/${match[2]}/${match[3]} ${match[4]}:${match[5]}:${match[6]}'}\` : value
    }

    const dateLabel = value => new Intl.DateTimeFormat('ja-JP', {
      month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false
    }).format(new Date(value))

    const durationLabel = minutes => {
      const hours = Math.floor(minutes / 60)
      const rest = minutes % 60
      return hours ? hours + '時間' + rest + '分' : rest + '分'
    }

    const starsLabel = value => value > 0 ? '★'.repeat(value) : '—'

    const metric = (label, value, note = '', className = '') => \
      \`<article class="metric"><div class="metric-label">${'${escapeHtml(label)}'}</div><div class="metric-value ${'${className}'}">${'${escapeHtml(value)}'}</div><div class="metric-note">${'${escapeHtml(note)}'}</div></article>\`

    const seriesLegend = series => \`<div class="legend">${'${series.map((item, index) => `'}<span><i class="swatch" style="background:${'${colors[index]}'}"></i>${'${escapeHtml(item.label)}'}</span>\`).join('')}</div>\`

    const chartMarkup = (id, title, copy, series) => {
      const action = id === 'cards-chart'
        ? '<button class="series-toggle" id="deck-toggle" type="button" aria-pressed="false">山札を隠す</button>'
        : ''
      return \`
        <article class="panel">
          <div class="panel-head"><div><h2>${'${escapeHtml(title)}'}</h2><p class="panel-copy">${'${escapeHtml(copy)}'}</p></div><div class="panel-tools">${'${seriesLegend(series)}${action}'}</div></div>
          <div class="chart" id="${'${id}'}"></div>
        </article>\`
    }

    const drawChart = (element, timeline, series) => {
      const width = Math.max(element.clientWidth, 320)
      const height = element.clientHeight || 320
      const margin = { top: 12, right: 18, bottom: 34, left: 46 }
      const innerWidth = width - margin.left - margin.right
      const innerHeight = height - margin.top - margin.bottom
      const allValues = series.flatMap(item => timeline.map(point => Number(point[item.key] || 0)))
      const maxValue = Math.max(...allValues, 1)
      const minValue = Math.min(...allValues, 0)
      const range = Math.max(maxValue - minValue, 1)
      const maxMinute = Math.max(...timeline.map(point => point.minute), 1)
      const x = minute => margin.left + minute / maxMinute * innerWidth
      const y = value => margin.top + (maxValue - value) / range * innerHeight
      const ticks = [0, .25, .5, .75, 1]
      const grid = ticks.map(fraction => {
        const value = Math.round(maxValue - fraction * range)
        const py = margin.top + fraction * innerHeight
        return \`<line class="grid-line" x1="${'${margin.left}'}" y1="${'${py}'}" x2="${'${width - margin.right}'}" y2="${'${py}'}"></line><text x="${'${margin.left - 8}'}" y="${'${py + 4}'}" text-anchor="end">${'${value}'}</text>\`
      }).join('')
      const paths = series.map((item, index) => {
        const points = timeline.map(point => \`${'${x(point.minute).toFixed(1)},${y(Number(point[item.key] || 0)).toFixed(1)}'}\`).join(' ')
        return \`<polyline class="series-line" stroke="${'${colors[item.colorIndex ?? index]}'}" points="${'${points}'}"></polyline>\`
      }).join('')
      const timeTicks = [0, .25, .5, .75, 1].map(fraction => {
        const minute = Math.round(maxMinute * fraction)
        const px = x(minute)
        return \`<text x="${'${px}'}" y="${'${height - 8}'}" text-anchor="middle">${'${Math.floor(minute / 60)}'}h</text>\`
      }).join('')

      element.innerHTML = \`<svg viewBox="0 0 ${'${width}'} ${'${height}'}" role="img" aria-label="${'${escapeHtml(series.map(item => item.label).join("・"))}'}の推移">${'${grid}${paths}${timeTicks}'}</svg>\`
    }

    const render = index => {
      const log = logs[index]
      tabs.querySelectorAll('.tab').forEach((tab, tabIndex) => {
        tab.setAttribute('aria-selected', String(tabIndex === index))
        tab.tabIndex = tabIndex === index ? 0 : -1
      })
      const invariantOk = log.invariantErrors.length === 0
      const rewardTestsOk = log.fixedRewardTests.every(test => test.ok)
      const rarityTestsOk = log.fixedRarityTests.every(test => test.ok)
      const rankPointTestsOk = log.fixedRankPointTests.every(test => test.ok)
      const predictionTestsOk = log.fixedPredictionTests.every(test => test.ok)
      const timeModelTestsOk = log.fixedTimeModelTests.every(test => test.ok)
      const entryRuleTestsOk = log.fixedEntryRuleTests.every(test => test.ok)
      const countdownTestsOk = log.fixedCountdownTests.every(test => test.ok)
      const holderTestsOk = log.fixedHolderTests.every(test => test.ok)
      const takeCooldownTestsOk = log.fixedTakeCooldownTests.every(test => test.ok)
      const fixedTestsOk = rewardTestsOk && rarityTestsOk && rankPointTestsOk && predictionTestsOk && timeModelTestsOk && entryRuleTestsOk && countdownTestsOk && holderTestsOk && takeCooldownTestsOk
      const fixedTestCount = log.fixedRewardTests.length + log.fixedRarityTests.length + log.fixedRankPointTests.length + log.fixedPredictionTests.length + log.fixedTimeModelTests.length + log.fixedEntryRuleTests.length + log.fixedCountdownTests.length + log.fixedHolderTests.length + log.fixedTakeCooldownTests.length
      const taxMetric = log.drawTax
        ? metric('給付 / ドロー税', log.subsidyPayments + ' / ' + log.drawTax.paid + ' P', 'スタック還流 ' + log.drawTax.stacked + ' / 未還流 ' + log.drawTax.pending)
        : metric('給付', log.subsidyPayments + ' P', log.eventsWritten + 'イベント')
      const taxPolicyNote = log.policy && Number.isFinite(Number(log.policy.draw_tax_threshold))
        ? log.policy.draw_tax_threshold + 'P超過分の' + log.policy.draw_tax_band + 'Pごとに1P課税、'
        : ''
      const rarityPolicyNote = log.policy?.rarity_growth === 'exponential'
        ? '★2以上を開始' + log.policy.rarity_initial_rate + '%から' + log.policy.rarity_boost_peak_hour + '時間で' + log.policy.rarity_peak_rate + '%へ指数増加。'
        : log.policy?.rarity_growth === 'final_three_hours'
          ? '通常はレア度1〜5を87/8/4/0.9/0.1%、終了3時間前から0/87/8/4/1%で抽選。'
        : log.policy?.rarity_growth === 'fixed'
          ? 'レア度1〜5を毎回87/8/4/0.9/0.1%で抽選。'
          : log.policy
          ? log.policy.rarity_boost_interval_minutes + '分ごとにレア率を' + Number(log.policy.rarity_boost_per_step).toFixed(4) + 'ポイント加算。'
          : ''
      const policyNote = log.policy ? '施策: ' + taxPolicyNote + rarityPolicyNote : ''
      const top = log.leaders[0]
      const eventChips = Object.entries(log.eventCounts)
        .filter(([event]) => event !== 'final')
        .map(([event, count]) => \`<span class="event-chip">${'${escapeHtml(eventLabels[event] || event)}'} <b>${'${count}'}</b></span>\`)
        .join('')
      const finalRows = log.finalPlayers.map((player, playerIndex) => \`
        <tr><td><span class="rank-cell">#${'${playerIndex + 1}'}</span> <strong>${'${escapeHtml(player.name)}'}</strong></td><td>${'${player.points}'} P</td><td>${'${player.rankPoints}'} R</td><td>${'${player.draws}'}</td><td>${'${player.takes}'}</td><td>${'${player.scorePosts}'}</td></tr>\`)
        .join('')
      const collectedRows = log.collectedCards.map(card => \`
        <tr><td><strong>#${'${card.cardId}'}</strong></td><td>${'${durationLabel(card.fieldMinutes)}'}</td><td>${'${card.scorePosts}'}</td><td>${'${card.participants}'}</td><td><span class="stars">${'${starsLabel(card.rarity)}'}</span></td><td><span class="stars">${'${starsLabel(card.difficulty)}'}</span></td><td>${'${card.stackCount}'}</td><td>${'${card.totalRewardPoints}'} P</td></tr>\`)
        .join('')
      const personalities = log.personalities.map(group => \`
        <div class="personality-row"><strong>${'${escapeHtml(group.name)}'}</strong><span>${'${group.players}'}人</span><span class="subtle">平均 ${'${group.averagePoints}'} P</span><span class="subtle">平均 ${'${group.averageRankPoints}'} R</span></div>\`)
        .join('')

      report.innerHTML = \`
        <div class="meta">
          <span>生成: ${'${generatedLabel(log.generatedAt)}'}</span><span>期間: ${'${dateLabel(log.startAt)}'} 〜 ${'${dateLabel(log.endAt)}'}</span><span>seed: ${'${log.seed}'}</span>
          <span>入力: ${'${escapeHtml(log.source.summary)}'} / ${'${escapeHtml(log.source.timeline)}'}</span>
        </div>
        <div class="grid">
          ${'${metric(\'参加者\', `${log.final.participants}人`, top ? `首位 ${top.name}` : \'首位なし\')}' }
          ${'${metric(\'総ポイント\', `${log.final.points} P`, \'最終保有量\')}' }
          ${'${metric(\'総ランクポイント\', `${log.final.rankPoints} R`, \'最終獲得量\')}' }
          ${'${metric(\'回収\', `${log.collections}件`, `場 ${log.final.fields} / 回収済 ${log.final.collected}`)}' }
          ${'${taxMetric}' }
          ${'${metric(\'整合性\', invariantOk && fixedTestsOk ? \'OK\' : \'要確認\', invariantOk && fixedTestsOk ? `不変条件0件・固定テスト${fixedTestCount}件成功` : `不変条件${log.invariantErrors.length}件`, invariantOk && fixedTestsOk ? \'status-ok\' : \'status-error\')}' }
        </div>
        ${'${chartMarkup(\'economy-chart\', \'プレイヤー経済の推移\', \'全参加者の保有ポイント・累計ランクポイント・場札の総還元ポイント。\', [{ key: \'points\', label: \'総ポイント\' }, { key: \'rankPoints\', label: \'総ランクポイント\' }, { key: \'totalRewards\', label: \'総還元ポイント\' }])}' }
        ${'${chartMarkup(\'cards-chart\', \'カード循環の推移\', \'山札・捨て札・場札・回収済みカードの枚数。\', [{ key: \'deck\', label: \'山札\' }, { key: \'trash\', label: \'捨て札\' }, { key: \'fields\', label: \'場札\' }, { key: \'collected\', label: \'回収済み\' }, { key: \'hands\', label: \'手札\' }])}' }
        <article class="panel"><h2>最終結果</h2><p class="panel-copy">ランクポイント降順。スコア投稿回数は初投稿と更新投稿の合計です。</p>
          <div class="table-wrap"><table class="data-table"><thead><tr><th>順位 / プレイヤー</th><th>終了時所持P</th><th>ランクP</th><th>ドロー数</th><th>テイク数</th><th>スコア投稿回数</th></tr></thead><tbody>${'${finalRows}'}</tbody></table></div>
        </article>
        <article class="panel"><h2>回収カードの概要</h2><p class="panel-copy">回収時刻順。場札時間はテイクから回収までの経過時間です。</p>
          <div class="table-wrap"><table class="data-table"><thead><tr><th>カード</th><th>場札総時間</th><th>投稿総数</th><th>参加者数</th><th>レア度</th><th>難易度</th><th>スタック数</th><th>総還元P</th></tr></thead><tbody>${'${collectedRows || \"<tr><td colspan=\\\"8\\\" class=\\\"empty\\\">回収カードなし</td></tr>\"}'}</tbody></table></div>
        </article>
        <article class="panel"><h2>プレイ傾向別（概要）</h2><p class="panel-copy">人数と最終値の平均のみを表示します。</p><div class="personality-list">${'${personalities}'}</div></article>
        <article class="panel"><h2>イベント構成</h2><p class="panel-copy">行動件数の偏りを確認するための集計です。</p><div class="events">${'${eventChips}'}</div>
          <p class="footnote">タイムラインはJSONLの状態を${intervalMinutes}分単位（各区間の最終状態）へ間引いています。表示点数: ${'${log.timeline.length}'}。${'${policyNote}'}描画はSVGの静的更新のみで、常時アニメーションや描画ループは使用していません。</p>
        </article>
      \`

      drawChart(document.getElementById('economy-chart'), log.timeline, [
        { key: 'points', label: '総ポイント' }, { key: 'rankPoints', label: '総ランクポイント' },
        { key: 'totalRewards', label: '総還元ポイント' }
      ])
      const cardSeries = [
        { key: 'deck', label: '山札', colorIndex: 0 }, { key: 'trash', label: '捨て札', colorIndex: 1 },
        { key: 'fields', label: '場札', colorIndex: 2 }, { key: 'collected', label: '回収済み', colorIndex: 3 },
        { key: 'hands', label: '手札', colorIndex: 4 }
      ]
      let deckHidden = false
      const drawCardsChart = () => drawChart(
        document.getElementById('cards-chart'),
        log.timeline,
        deckHidden ? cardSeries.filter(series => series.key !== 'deck') : cardSeries
      )
      const deckToggle = document.getElementById('deck-toggle')
      deckToggle.addEventListener('click', () => {
        deckHidden = !deckHidden
        deckToggle.setAttribute('aria-pressed', String(deckHidden))
        deckToggle.textContent = deckHidden ? '山札を表示' : '山札を隠す'
        drawCardsChart()
      })
      drawCardsChart()
    }

    logs.forEach((log, index) => {
      const button = document.createElement('button')
      button.className = 'tab'
      button.type = 'button'
      button.role = 'tab'
      button.textContent = \`${'${index === 0 ? \'最新 · \' : \'\'}${generatedLabel(log.generatedAt)}'}\`
      button.addEventListener('click', () => render(index))
      button.addEventListener('keydown', event => {
        if (!['ArrowLeft', 'ArrowRight'].includes(event.key)) return
        const offset = event.key === 'ArrowRight' ? 1 : -1
        const nextIndex = (index + offset + logs.length) % logs.length
        tabs.children[nextIndex].focus()
        render(nextIndex)
      })
      tabs.appendChild(button)
    })

    let resizeTimer
    window.addEventListener('resize', () => {
      window.clearTimeout(resizeTimer)
      resizeTimer = window.setTimeout(() => {
        const selected = [...tabs.children].findIndex(tab => tab.getAttribute('aria-selected') === 'true')
        render(Math.max(selected, 0))
      }, 120)
    }, { passive: true })

    render(0)
  </script>
</body>
</html>
`

fs.writeFileSync(reportPath, html)
console.log(`Generated ${reportPath}`)
console.log(`Loaded ${logs.length} logs, newest first: ${logs.map(log => log.generatedAt).join(', ')}`)
