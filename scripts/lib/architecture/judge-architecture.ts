// judge-architecture.ts — what the architecture guard rejects in a product file before it is written (ADR 0006
// point 9): an outside import in the core or in the office UI, a port file without its partner, and an adapter file
// outside the naming pattern of ADR 0023.

import { builtinModules } from 'node:module';
import { basename, dirname, posix } from 'node:path';

// The source folders are judged; a package's own config files beside src (vitest.config.ts) use its tools.
const core = /^packages\/core\/src\//;
const officeUi = /^apps\/office-ui\/src\//;
const token = /^packages\/core\/src\/port\/outgoing\/(.+)\.token\.ts$/;
const portInterface = /^packages\/core\/src\/port\/outgoing\/(.+)\.interface\.ts$/;
const adapter = /^packages\/infrastructure\/src\/.*\/([^/]+)-[^/-]+\.adapter\.ts$/;
const anyAdapter = /^packages\/infrastructure\/src\/.*\.adapter\.ts$/;
// The core's one library (ADR 0021); every other package belongs to an adapter.
const coreLibrary = 'zod';
const builtins = new Set(builtinModules);

/**
 * Every module specifier the text names: static and type imports and re-exports at the start of a line or after a
 * semicolon, and
 * `import()` and `require()` anywhere, in single or double quotes or backticks without interpolation. Comments are
 * removed first, so an example in a doc comment raises no alarm; a `//` right after a colon or a quote is kept,
 * because it starts a URL inside a string.
 */
function moduleSpecifiers(text: string): string[] {
	const found: string[] = [];
	const code = text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1');
	const forms = [
		/(?:^|;)\s*(?:import|export)\b[^'"`;]*?\bfrom\s*(['"`])([^'"`$]+)\1/gm,
		/(?:^|;)\s*import\s*(['"`])([^'"`$]+)\1/gm,
		/\bimport\s*\(\s*(['"`])([^'"`$]+)\1\s*\)/g,
		/\brequire\s*\(\s*(['"`])([^'"`$]+)\1\s*\)/g,
	];
	for (const form of forms) for (const match of code.matchAll(form)) found.push(match[2] ?? '');
	return found;
}

function isNodeModule(specifier: string): boolean {
	return specifier.startsWith('node:') || builtins.has(specifier.split('/')[0] ?? '');
}

/** The interface name a port file must export: `bookingRepository` gives `IBookingRepository`. */
function interfaceName(port: string): string {
	return `I${port.charAt(0).toUpperCase()}${port.slice(1)}`;
}

/**
 * Returns the findings for the text a repo-relative path is about to hold; `exists` answers whether another
 * repo-relative path exists. An empty list passes.
 */
export function judgeArchitecture(path: string, text: string, exists: (other: string) => boolean): string[] {
	const findings: string[] = [];
	const isSpec = /\.spec\.(ts|tsx|mts|cts)$/.test(path);
	const home = core.test(path) ? 'packages/core/' : officeUi.test(path) ? 'apps/office-ui/' : '';
	for (const specifier of moduleSpecifiers(text)) {
		const relative = specifier.startsWith('.');
		// A relative path that leaves its own package is a cross-package import under another name.
		if (relative && home !== '' && !posix.normalize(posix.join(dirname(path), specifier)).startsWith(home)) {
			findings.push(
				`'${specifier}' leaves ${home.slice(0, -1)}; import another package by its name, if the zones allow it`,
			);
			continue;
		}
		if (core.test(path) && !relative && specifier !== coreLibrary && !(isSpec && specifier === 'vitest')) {
			findings.push(
				isNodeModule(specifier)
					? `the core imports the Node module '${specifier}'; IO belongs to an adapter in packages/infrastructure`
					: `the core imports the package '${specifier}'; the core imports only ${coreLibrary}, an adapter the rest`,
			);
		}
		if (
			officeUi.test(path) &&
			(isNodeModule(specifier) || /^@pixecutive\/(core|infrastructure)(\/|$)/.test(specifier))
		) {
			findings.push(`the office UI imports '${specifier}'; it speaks only through @pixecutive/protocol`);
		}
	}
	if (anyAdapter.test(path) && !adapter.test(path)) {
		findings.push(`${basename(path)} is not named <port>-<technology>.adapter.ts`);
	}
	const port = token.exec(path)?.[1] ?? adapter.exec(path)?.[1];
	if (port !== undefined && !exists(`packages/core/src/port/outgoing/${port}.interface.ts`)) {
		findings.push(`${basename(path)} has no port packages/core/src/port/outgoing/${port}.interface.ts`);
	}
	const named = portInterface.exec(path)?.[1];
	if (named !== undefined && !new RegExp(`export\\s+interface\\s+${interfaceName(named)}\\b`).test(text)) {
		findings.push(`${basename(path)} must export the interface ${interfaceName(named)}`);
	}
	return findings;
}
