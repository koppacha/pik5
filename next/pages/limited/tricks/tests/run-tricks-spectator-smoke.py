"""Run the Playwright CLI scenarios with synthetic API data only."""
import os
import subprocess
import sys
from pathlib import Path

root = Path(__file__).resolve().parent.parent
variant = sys.argv[1] if len(sys.argv) > 1 and sys.argv[1] in ('extra', 'access') else 'smoke'
scenario = root / 'tests' / f'tricks-spectator-{variant}.js'
wrapper = Path.home() / '.codex/skills/playwright/scripts/playwright_cli.sh'
output = root / 'output/playwright'
output.mkdir(parents=True, exist_ok=True)
url = os.environ.get('TRICKS_E2E_BASE_URL', 'http://localhost:3005').rstrip('/')
session = f'tricks-spectator-{variant}'
command = [str(wrapper), '--session', session]

with (output / f'{variant}-cli-output.txt').open('w') as stdout, (output / f'{variant}-cli-stderr.txt').open('w') as stderr:
    subprocess.run(command + ['open', url + '/limited/trick', '--headed'], cwd=root, stdout=stdout, stderr=stderr, check=True)
    try:
        source = scenario.read_text().replace('http://localhost:3005', url)
        result = subprocess.run(command + ['run-code', source], cwd=root, stdout=stdout, stderr=stderr)
    finally:
        subprocess.run(command + ['close'], cwd=root, stdout=stdout, stderr=stderr)
text = (output / f'{variant}-cli-output.txt').read_text()
result_start = text.find('### Result')
error_start = text.find('### Error')
if error_start >= 0:
    print(text[error_start:].split('### Ran Playwright code')[0])
else:
    print(text[result_start:].split('### Ran Playwright code')[0])
raise SystemExit(result.returncode)
