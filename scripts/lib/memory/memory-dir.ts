// memory-dir.ts — where the harness keeps the auto-memory of a repo, derived the same way for gate, hook and probe.

import { homedir } from 'node:os';
import { join } from 'node:path';

/**
 * Returns `~/.claude/projects/<root with / and . replaced by ->/memory`. Derived, never configured: a configured path
 * would be a home directory inside the repo and silently wrong once the checkout moves. `MEMORY_DIR` overrides it for
 * the probes.
 */
export function memoryDir(root: string): string {
	const override = process.env['MEMORY_DIR'];
	if (override !== undefined && override !== '') return override;
	return join(homedir(), '.claude', 'projects', root.replace(/[/.]/g, '-'), 'memory');
}
