/** Minimal CodeBot starters for the languages supported by the Botzone runtime. */
export const BOT_TEMPLATES: Record<string, string> = {
  python: `import json
import sys

# CodeBot stdin is this player's current command JSON, not a requests/responses wrapper.
# The judge must include any history the bot needs in this command; the process is fresh each turn.
# Keep diagnostics on stderr; stdout is reserved for the one response line.
for line in sys.stdin:
    line = line.strip()
    if not line:
        continue
    command = json.loads(line)
    move = 0  # TODO: choose a legal move from command
    print(json.dumps({"move": move, "debug": f"command={command}"}), flush=True)
`,
  cpp: `#include <iostream>
#include <string>

int main() {
    std::string command;
    while (std::getline(std::cin, command)) {
        if (command.empty()) continue;
        // CodeBot stdin is this player's current command JSON, not requests/responses.
        // Parse command and choose a legal move; stdout is the response JSON.
        const int move = 0; // TODO: choose a legal move
        std::cout << R"JSON({"move":)JSON" << move << R"JSON(,"debug":"starter"})JSON" << std::endl;
        // std::endl flushes stdout. Send diagnostics to std::cerr, never stdout.
    }
    return 0;
}
`,
  javascript: `const readline = require('node:readline');
const rl = readline.createInterface({ input: process.stdin });
rl.on('line', (line) => {
  if (!line.trim()) return;
  const command = JSON.parse(line); // one current command JSON per process/turn; stderr is for diagnostics
  const move = 0; // TODO: choose a legal move from command
  process.stdout.write(JSON.stringify({ move, debug: \`command=\${JSON.stringify(command)}\` }) + '\\n');
});
`,
  typescript: `import * as readline from 'node:readline';

const rl = readline.createInterface({ input: process.stdin });
rl.on('line', (line: string) => {
  if (!line.trim()) return;
  const command: unknown = JSON.parse(line); // current command JSON, not a wrapper; stderr is for diagnostics
  const move = 0; // TODO: choose a legal move from command
  process.stdout.write(JSON.stringify({ move, debug: \`command=\${JSON.stringify(command)}\` }) + '\\n');
});
`,
}

export function botTemplate(language: string): string | undefined {
  return BOT_TEMPLATES[language]
}
