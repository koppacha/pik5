import {readFile, writeFile} from 'node:fs/promises'
import {parseLegacyLimitedIdeas} from './legacyLimitedIdeas.mjs'

const [input, output] = process.argv.slice(2)
if (!input || !output) throw new Error('Usage: node prisma/prepare-legacy-limited-ideas.mjs <mysql-output.txt> <fixture.json>')
const fixture = parseLegacyLimitedIdeas(await readFile(input, 'utf8'))
await writeFile(output, JSON.stringify(fixture, null, 2) + '\n', {flag: 'wx'})
console.log(JSON.stringify({sourceRows: fixture.sourceRowCount, effectiveRules: fixture.rules.length}))
