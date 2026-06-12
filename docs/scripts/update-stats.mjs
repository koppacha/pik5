import { execFileSync } from 'node:child_process'
import { readdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'

const repository = resolve(dirname(new URL(import.meta.url).pathname), '../..')
const logsDirectory = resolve(repository, 'docs/codex-logs')
const outputPath = resolve(repository, 'docs/stats.html')
const formatter = new Intl.NumberFormat('ja-JP')
const escapeHtml = (value) =>
  String(value).replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[char])

const gitLog = execFileSync(
  'git',
  ['log', '--date=short', '--pretty=format:@@@%h%x09%ad%x09%s', '--numstat'],
  { cwd: repository, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }
)

const commits = gitLog.split('\n@@@').filter(Boolean).map((block) => {
  const [header, ...stats] = block.replace(/^@@@/, '').split('\n')
  const [hash, date, ...subjectParts] = header.split('\t')
  const subject = subjectParts.join('\t')
  const changedLines = stats.reduce((sum, line) => {
    const [added, deleted] = line.split('\t')
    return sum + (Number(added) || 0) + (Number(deleted) || 0)
  }, 0)

  return {
    hash,
    date,
    subject,
    version: subject.match(/ver\.\d+\.\d+/i)?.[0] ?? 'ver.-.--',
    changedLines
  }
})

const sessionPattern = /^(\d{4}-\d{2}-\d{2})-(.+)\.md$/
const promptPattern = /### User\n\n```text\n([\s\S]*?)\n```/g
const sessions = []

for (const fileName of (await readdir(logsDirectory)).sort()) {
  const match = fileName.match(sessionPattern)
  if (!match) continue

  const markdown = await readFile(resolve(logsDirectory, fileName), 'utf8')
  const prompts = [...markdown.matchAll(promptPattern)].map((prompt) => prompt[1])
  sessions.push({
    date: match[1],
    sessionId: match[2],
    promptChars: prompts.reduce((sum, prompt) => sum + [...prompt].length, 0)
  })
}

const monthlyMap = new Map()
const getMonth = (date) => date.slice(0, 7)
const ensureMonth = (month) => {
  if (!monthlyMap.has(month)) {
    monthlyMap.set(month, { month, changedLines: 0, promptChars: 0 })
  }
  return monthlyMap.get(month)
}

commits.forEach((commit) => {
  ensureMonth(getMonth(commit.date)).changedLines += commit.changedLines
})
sessions.forEach((session) => {
  ensureMonth(getMonth(session.date)).promptChars += session.promptChars
})

const monthly = [...monthlyMap.values()].sort((a, b) => b.month.localeCompare(a.month))
const totalChangedLines = commits.reduce((sum, commit) => sum + commit.changedLines, 0)
const totalPromptChars = sessions.reduce((sum, session) => sum + session.promptChars, 0)
const tableRows = (rows) => rows.join('\n')
const generatedAt = new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })

const html = `<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>pik5 Development Statistics</title>
  <style>
    :root { color-scheme: dark; font-family: Inter, system-ui, sans-serif; background: #0b1020; color: #edf2f7; }
    * { box-sizing: border-box; }
    body { margin: 0; background: #0b1020; }
    main { width: min(1440px, 100%); margin: 0 auto; padding: 32px 20px 64px; }
    h1, h2 { margin: 0; letter-spacing: 0; }
    h1 { font-size: clamp(24px, 4vw, 38px); }
    h2 { margin-top: 36px; font-size: 20px; }
    p { margin: 8px 0 0; color: #9aa8bd; }
    .cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(190px, 1fr)); gap: 12px; margin-top: 24px; }
    .card { padding: 18px; border: 1px solid #26334d; border-radius: 8px; background: #121a2d; }
    .label { color: #9aa8bd; font-size: 12px; }
    .value { margin-top: 8px; font-size: 26px; font-weight: 700; }
    .table-wrap { overflow-x: auto; margin-top: 12px; border: 1px solid #26334d; border-radius: 8px; }
    table { width: 100%; border-collapse: collapse; background: #121a2d; font-size: 13px; }
    th, td { padding: 11px 14px; border-bottom: 1px solid #26334d; text-align: left; white-space: nowrap; }
    th { position: sticky; top: 0; color: #a9b8d0; background: #18243a; font-size: 12px; }
    tr:last-child td { border-bottom: 0; }
    .number { text-align: right; font-variant-numeric: tabular-nums; }
    code { color: #7dd3fc; }
  </style>
</head>
<body>
  <main>
    <h1>Development Statistics</h1>
    <p>pik5 repository activity dashboard / 更新: ${escapeHtml(generatedAt)}</p>
    <section class="cards">
      <div class="card"><div class="label">Commits</div><div class="value">${formatter.format(commits.length)}</div></div>
      <div class="card"><div class="label">Changed lines</div><div class="value">${formatter.format(totalChangedLines)}</div></div>
      <div class="card"><div class="label">Codex sessions</div><div class="value">${formatter.format(sessions.length)}</div></div>
      <div class="card"><div class="label">User prompt chars</div><div class="value">${formatter.format(totalPromptChars)}</div></div>
    </section>
    <h2>Monthly Dashboard</h2>
    <div class="table-wrap"><table><thead><tr><th>Month</th><th class="number">Changed lines</th><th class="number">Prompt chars</th></tr></thead><tbody>
${tableRows(monthly.map(({ month, changedLines, promptChars }) => `      <tr><td>${month.replace('-', '年')}月</td><td class="number">${formatter.format(changedLines)}</td><td class="number">${formatter.format(promptChars)}</td></tr>`))}
    </tbody></table></div>
    <h2>Commit History</h2>
    <div class="table-wrap"><table><thead><tr><th>Date</th><th>Hash</th><th>Version</th><th class="number">Changed lines</th><th>Comment</th></tr></thead><tbody>
${tableRows(commits.map(({ date, hash, version, changedLines, subject }) => `      <tr><td>${date}</td><td><code>${hash}</code></td><td>${escapeHtml(version)}</td><td class="number">${formatter.format(changedLines)}</td><td>${escapeHtml(subject)}</td></tr>`))}
    </tbody></table></div>
    <h2>Codex Sessions</h2>
    <div class="table-wrap"><table><thead><tr><th>Date</th><th>Session ID</th><th class="number">User prompt chars</th></tr></thead><tbody>
${tableRows(sessions.map(({ date, sessionId, promptChars }) => `      <tr><td>${date}</td><td><code>${escapeHtml(sessionId)}</code></td><td class="number">${formatter.format(promptChars)}</td></tr>`))}
    </tbody></table></div>
  </main>
</body>
</html>
`

await writeFile(outputPath, html)
console.log(`Updated docs/stats.html: ${commits.length} commits, ${sessions.length} sessions`)
