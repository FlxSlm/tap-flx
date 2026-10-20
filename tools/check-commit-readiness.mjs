import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

// Every Git invocation here is read-only. This tool never stages or changes Git configuration.
const git = (...args) => execFileSync('git', args, { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024, stdio: ['pipe', 'pipe', 'pipe'] });
const problems = [];
const notes = [];
const knownDeleted = new Set(['AGENT_HANDOFF_TEMPLATE.md', 'ANTIGRAVITY_START_PROMPT.md', 'CHANGELOG.md', 'CURRENT_STATUS.md', 'DEVELOPMENT_RULES.md', 'PROJECT_CONTEXT.md']);
const secretPatterns = [
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
  /\bgh[pousr]_[A-Za-z0-9]{30,}\b/,
  /\bgithub_pat_[A-Za-z0-9_]{30,}\b/,
  /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/,
  /\bsk-(?:proj-)?[A-Za-z0-9_-]{24,}\b/,
  /\beyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\b/,
  /(?:mysql|postgres(?:ql)?):\/\/[^\s/:]+:[^\s@]+@/i,
  /\b(?:api[_-]?key|client[_-]?secret|access[_-]?token|refresh[_-]?token|DB_PASSWORD|AWS_SECRET_ACCESS_KEY)[ \t]*[:=][ \t]*["']?([A-Za-z0-9+/_=-]{16,})/i,
];
const dangerousPath = name => /\.pdf$/i.test(name) || /(?:^|\/)\.env(?:\.|$)/i.test(name) && !name.endsWith('.env.example')
  || /(?:^|\/)(?:auth\.json|credentials(?:\.json)?|id_rsa|id_ed25519|\.npmrc)$/i.test(name)
  || /\.(?:key|pem|p12|pfx|sqlite(?:3)?(?:-.*)?|sql|bundle)$/i.test(name)
  || /(?:^|\/)(?:\.local-backups|node_modules|vendor|dist|coverage)\//.test(name);
const binaryAllowed = /\.(?:png|ico)$/i;
const expected = /^(?:TA_Rebuild_Reconciliation\/.*\.md|tools\/[A-Za-z0-9._-]+\.mjs|backend\/storage\/(?:.*\/)?\.gitignore|backend\/(?:app|bootstrap|config|database|public|resources|routes|tests)\/.*|frontend\/(?:src|public)\/.*|(?:backend|frontend)\/(?:\.[A-Za-z0-9._-]+|README\.md|artisan|composer\.(?:json|lock)|package(?:-lock)?\.json|phpunit\.xml|vite\.config\.js|index\.html)|docs\/.*|[A-Za-z0-9._-]+\.md|\.gitignore)$/;
const reportPath = name => dangerousPath(name) ? '[sensitive path redacted]' : name;
const scanText = (text, name, prefix) => {
  if (secretPatterns.some(pattern => pattern.test(text))) problems.push(`${prefix}: possible credential in ${reportPath(name)}`);
  if (name.endsWith('.env.example')) {
    for (const line of text.split(/\r?\n/)) {
      const match = line.match(/^\s*([A-Z_0-9]+)[ \t]*=[ \t]*(.*)$/);
      if (!match || !/(?:PASSWORD|SECRET|TOKEN|API_KEY|APP_KEY|CREDENTIAL|ACCESS_KEY)/.test(match[1])) continue;
      const value = match[2].trim().replace(/^["']|["']$/g, '');
      if (value && value !== 'null' && !/^\$\{[A-Z_0-9]+\}$/.test(value)) problems.push(`${prefix}: nonempty credential example needs review in ${reportPath(name)}`);
    }
  }
};

try {
  const root = git('rev-parse', '--show-toplevel').trim();
  if (path.resolve(root).toLowerCase() !== process.cwd().toLowerCase()) throw new Error('Run from repository root.');
  const branch = git('branch', '--show-current').trim();
  const origin = git('remote', 'get-url', 'origin').trim();
  if (branch !== 'main') problems.push('Unexpected active branch.');
  if (origin !== 'https://github.com/FlxSlm/tap-flx.git') problems.push('Unexpected origin URL.');
  const status = git('status', '--porcelain=v1', '-z', '--untracked-files=all').split('\0').filter(Boolean);
  if (status.some(row => /^(?:UU|AA|DD|AU|UA|DU|UD)/.test(row))) problems.push('Unresolved merge state.');
  const deleted = [...new Set([...git('ls-files', '--deleted', '-z').split('\0'), ...git('diff', '--cached', '--name-only', '--diff-filter=D', '-z').split('\0')].filter(Boolean))];
  for (const name of deleted) if (!knownDeleted.has(name)) problems.push(`Unexpected deleted file: ${reportPath(name)}`);
  notes.push(`Existing owner deletions retained: ${deleted.length}.`);
  try { git('diff', '--check'); git('diff', '--cached', '--check'); } catch { problems.push('Git whitespace/conflict-marker check failed.'); }

  const tracked = git('ls-files', '--cached', '-z').split('\0').filter(Boolean);
  const untracked = git('ls-files', '--others', '--exclude-standard', '-z').split('\0').filter(Boolean);
  const candidates = [...new Set([...tracked, ...untracked])].filter(name => fs.existsSync(name));
  let scanned = 0;
  for (const name of candidates) {
    if (dangerousPath(name)) { problems.push(`Sensitive/generated file would be included: ${reportPath(name)}`); continue; }
    if (!expected.test(name)) problems.push(`Unexpected candidate path: ${reportPath(name)}`);
    const stat = fs.lstatSync(name);
    if (stat.isSymbolicLink()) { problems.push(`Symlink needs review: ${reportPath(name)}`); continue; }
    if (stat.size > 2 * 1024 * 1024) { problems.push(`Oversized candidate needs review: ${reportPath(name)}`); continue; }
    if (binaryAllowed.test(name)) continue;
    const data = fs.readFileSync(name);
    if (data.includes(0)) { problems.push(`Unexpected binary candidate: ${reportPath(name)}`); continue; }
    scanText(data.toString('utf8'), name, 'Working tree');
    scanned++;
  }
  const privateFiles = [];
  const walk = dir => {
    if (!fs.existsSync(dir)) return;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const name = path.posix.join(dir, entry.name);
      if (entry.isDirectory()) walk(name);
      else if (/\.pdf$/i.test(name)) privateFiles.push(name);
    }
  };
  walk('docs/aset_parser');
  for (const name of privateFiles) {
    try { git('check-ignore', '--', name); } catch { problems.push('A local financial PDF is not ignored.'); }
    if (tracked.includes(name)) problems.push('A local financial PDF is tracked; ignore rules alone are insufficient.');
  }
  for (const name of ['backend/.env', 'frontend/.env', '.local-backups/before-pdf-cleanup.bundle']) {
    if (fs.existsSync(name)) {
      try { git('check-ignore', '--', name); } catch { problems.push('A local environment/backup file is not ignored.'); }
      if (tracked.includes(name)) problems.push('A local environment/backup is already tracked.');
    }
  }
  let remoteHead = null;
  let unpushed = null;
  let historicalTextBlobs = 0;
  const headObjects = git('rev-list', '--objects', 'HEAD').split('\n');
  for (const object of headObjects) {
    const index = object.indexOf(' ');
    if (index >= 0 && dangerousPath(object.slice(index + 1))) problems.push('Sensitive path is reachable in existing HEAD history; index/history remediation requires the owner.');
  }
  try {
    remoteHead = git('ls-remote', '--heads', 'origin', 'main').trim().split(/\s+/)[0];
    if (!/^[a-f0-9]{40}$/.test(remoteHead)) throw new Error('Remote branch missing.');
    git('cat-file', '-e', `${remoteHead}^{commit}`);
    git('merge-base', '--is-ancestor', remoteHead, 'HEAD');
    unpushed = Number(git('rev-list', '--count', `${remoteHead}..HEAD`).trim());
    const objects = git('rev-list', '--objects', `${remoteHead}..HEAD`).split('\n').filter(Boolean);
    const seen = new Set();
    for (const object of objects) {
      const index = object.indexOf(' ');
      if (index < 0) continue;
      const hash = object.slice(0, index);
      const name = object.slice(index + 1);
      if (dangerousPath(name)) { problems.push('Sensitive path appears in unpushed history.'); continue; }
      if (seen.has(hash) || git('cat-file', '-t', hash).trim() !== 'blob') continue;
      seen.add(hash);
      if (binaryAllowed.test(name)) continue;
      const size = Number(git('cat-file', '-s', hash).trim());
      if (size > 2 * 1024 * 1024) { problems.push('Oversized historical blob needs review.'); continue; }
      const content = git('cat-file', '-p', hash);
      if (content.includes('\0')) { problems.push('Unexpected historical binary needs review.'); continue; }
      scanText(content, name, 'Unpushed history');
      historicalTextBlobs++;
    }
  } catch {
    problems.push('Remote/unpushed-history verification incomplete; no fetch or Git mutation was attempted.');
  }
  console.log(JSON.stringify({
    branch, origin, candidates: candidates.length, tracked: tracked.length, untracked: untracked.length,
    ownerDeletedFiles: deleted, textFilesScanned: scanned, privatePdfsIgnored: privateFiles.length,
    remoteMain: remoteHead, unpushedCommits: unpushed, historicalTextBlobsScanned: historicalTextBlobs,
    notes: [...notes, 'Pattern scan is not a guarantee against all secrets or PII. Existing PNG/ICO assets excluded from text scanning.', 'Runtime database migrations, MySQL concurrency and browser E2E beyond automated component tests are separate release checks.'],
    problems: [...new Set(problems)],
    status: problems.length ? 'BLOCKED — DO NOT COMMIT' : 'READY FOR MANUAL COMMIT',
  }, null, 2));
  process.exitCode = problems.length ? 1 : 0;
} catch {
  console.log(JSON.stringify({ status: 'BLOCKED — DO NOT COMMIT', problems: ['Readiness inspection failed; no Git mutation was attempted.'] }));
  process.exitCode = 1;
}
