import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import cp from 'node:child_process';
import ts from 'typescript';

const modulePath = path.resolve('app/utils/bot-templates.ts');
const compiled = ts.transpileModule(fs.readFileSync(modulePath, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
const sandbox = { exports: {} };
vm.runInNewContext(compiled, sandbox, { filename: modulePath });
const templates = sandbox.exports.BOT_TEMPLATES;
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'botzone-template-probe-'));
fs.symlinkSync(path.resolve('node_modules'), path.join(dir, 'node_modules'), 'dir');
function run(exe, args, input) {
  const r = cp.spawnSync(exe, args, { input, encoding: 'utf8', cwd: dir, timeout: 15000 });
  if (r.error || r.status !== 0) throw new Error(`${exe} failed (${r.status}): ${r.stderr || r.stdout || r.error}`);
  return r.stdout.trim();
}
const fixture = '{"target":5}\n';
const expected = { move: 5 };
try {
  for (const [lang, code] of Object.entries(templates)) {
    if (!code.includes('command')) throw new Error(`${lang}: missing raw-command protocol guidance`);
    if (!code.includes('stderr') && !code.includes('std::cerr')) throw new Error(`${lang}: missing stderr guidance`);
    let stdout;
    if (lang === 'python') {
      fs.writeFileSync(path.join(dir, 'bot.py'), code);
      stdout = run('python3', ['bot.py'], fixture);
    } else if (lang === 'javascript') {
      fs.writeFileSync(path.join(dir, 'bot.js'), code);
      stdout = run('node', ['bot.js'], fixture);
    } else if (lang === 'typescript') {
      fs.writeFileSync(path.join(dir, 'bot.ts'), code);
      run(path.resolve('node_modules/.bin/tsc'), ['bot.ts', '--target', 'ES2020', '--module', 'commonjs', '--types', 'node', '--skipLibCheck', '--outDir', 'out']);
      stdout = run('node', ['out/bot.js'], fixture);
    } else if (lang === 'cpp') {
      fs.writeFileSync(path.join(dir, 'bot.cpp'), code);
      run('g++', ['-std=c++17', '-O0', 'bot.cpp', '-o', 'bot']);
      stdout = run('./bot', [], fixture);
    }
    const parsed = JSON.parse(stdout);
    if (typeof parsed.move !== 'number') throw new Error(`${lang}: response JSON lacks numeric move: ${stdout}`);
    console.log(`${lang}: compiled/executed, JSON stdout=${stdout}`);
  }
  const py = fs.readFileSync('examples/botzone/closest-bot.py', 'utf8');
  fs.writeFileSync(path.join(dir, 'closest.py'), py);
  const stdout = run('python3', ['closest.py'], fixture);
  const parsed = JSON.parse(stdout);
  if (JSON.stringify(parsed) !== JSON.stringify(expected)) throw new Error(`closest fixture expected ${JSON.stringify(expected)}, got ${stdout}`);
  console.log(`trusted closest fixture: executed, expected move=5; stdout=${stdout}`);

  const tutorial = fs.readFileSync('app/components/compete/WikiBotTutorial.vue', 'utf8');
  for (const [name, language] of [['simpleBotPy', 'python'], ['simpleBotCpp', 'cpp'], ['smartBotPy', 'python']]) {
    const match = tutorial.match(new RegExp('const ' + name + ' = `([\\s\\S]*?)`'))
    if (!match) throw new Error(`tutorial example ${name} not found`);
    const file = language === 'cpp' ? `${name}.cpp` : `${name}.py`;
    fs.writeFileSync(path.join(dir, file), match[1]);
    if (language === 'cpp') run('g++', ['-std=c++17', '-O0', file, '-o', name]);
    const output = language === 'cpp' ? run(`./${name}`, [], fixture) : run('python3', [file], fixture);
    if (JSON.parse(output).move !== 5) throw new Error(`tutorial example ${name} expected move=5, got ${output}`);
    console.log(`tutorial ${name}: compiled/executed, move=5`);
  }
} finally {
  fs.rmSync(dir, { recursive: true, force: true });
}
