// check-one-export.ts — rejects a TypeScript file with more than one value export and no `@aggregate <reason>` marker.
// Usage: node scripts/check-one-export.ts [--staged | <path>…]; type exports are free, the browser UI is out of scope.

import { readFileSync } from 'node:fs';
import { filesToCheck } from './lib/files-to-check.ts';

const valueExport = /^export (?:const|let|function|async function|class|abstract class|enum|default)\b/;
const aggregateMarker = /@aggregate\s+[A-Za-z]/;

const files = filesToCheck(process.argv.slice(2)).filter(
	(path) => path.endsWith('.ts') && !path.endsWith('.d.ts') && !path.endsWith('.spec.ts') && !path.startsWith('apps/web/'),
);

let failed = false;
for (const path of files) {
	const lines = readFileSync(path, 'utf8').split('\n');
	const exports = lines.flatMap((line, index) => (valueExport.test(line) ? [index + 1] : []));
	if (exports.length <= 1 || aggregateMarker.test(lines.join('\n'))) continue;
	console.log(`⛔ ${path}:${exports.join(',')} — ${exports.length} value exports and no @aggregate marker`);
	failed = true;
}
if (failed) {
	console.log('   Split the file, or mark one concept that needs several values with: @aggregate <reason in one sentence>');
	process.exit(1);
}
console.log(`✅ check-one-export: ${files.length} TypeScript files`);
