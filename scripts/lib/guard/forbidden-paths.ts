// forbidden-paths.ts — paths that never enter the repo, whatever their content.

/** Returns one finding per path that is a real environment file or the operator's local config. */
export function forbiddenPaths(paths: readonly string[]): string[] {
	const findings: string[] = [];
	for (const path of paths) {
		const name = path.split('/').pop() ?? path;
		if (/\.example(\.json)?$/.test(name) || name.endsWith('.schema.json')) continue;
		if (name === '.env' || name.startsWith('.env.')) {
			findings.push(`${path} — environment file; only *.example files belong in the repo`);
		} else if (name === 'pixecutive.local.json') {
			findings.push(`${path} — the operator's local config never enters the repo`);
		}
	}
	return findings;
}
