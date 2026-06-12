import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { basename, dirname, resolve } from 'node:path'

const jsonlPath = process.argv[2]

if (!jsonlPath) {
  console.error('Usage: node docs/scripts/export-codex-log.mjs <rollout.jsonl>')
  process.exit(1)
}

const repository = resolve(dirname(new URL(import.meta.url).pathname), '../..')
const logDirectory = resolve(repository, 'docs/codex-logs')
const records = (await readFile(jsonlPath, 'utf8'))
  .split('\n')
  .filter(Boolean)
  .map((line) => JSON.parse(line))

const meta = records.find((record) => record.type === 'session_meta')?.payload

if (!meta?.id || !meta?.timestamp) {
  throw new Error(`Session metadata was not found in ${jsonlPath}`)
}

const isBootstrap = (text) =>
  text.startsWith('# AGENTS.md instructions for ') ||
  text.startsWith('<environment_context>')

const messages = records.flatMap((record) => {
  if (record.type !== 'response_item' || record.payload?.type !== 'message') {
    return []
  }

  const { role, content } = record.payload
  if (role !== 'user' && role !== 'assistant') {
    return []
  }

  const text = content
    ?.filter((item) => item.type === 'input_text' || item.type === 'output_text')
    .map((item) => item.text)
    .join('\n')

  if (!text || (role === 'user' && isBootstrap(text))) {
    return []
  }

  return [{ role, text }]
})

const date = meta.timestamp.slice(0, 10)
const outputPath = resolve(logDirectory, `${date}-${meta.id}.md`)
const markdown = [
  '# Codex Session Transcript',
  '',
  `- Date: ${date}`,
  `- Thread ID: ${meta.id}`,
  `- Repository: \`${meta.cwd}\``,
  `- Source: \`${resolve(jsonlPath)}\``,
  '- Note: This file is generated from locally accessible Codex JSONL. System/developer instructions, AGENTS bootstrap text, environment context, and full tool payloads are intentionally omitted.',
  '',
  '## Conversation',
  '',
  ...messages.flatMap(({ role, text }) => [
    `### ${role === 'user' ? 'User' : 'Assistant'}`,
    '',
    '```text',
    text,
    '```',
    ''
  ])
].join('\n')

await mkdir(logDirectory, { recursive: true })
await writeFile(outputPath, markdown)
console.log(`${basename(outputPath)}: ${messages.length} messages`)
