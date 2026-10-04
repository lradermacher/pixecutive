import type { ESLint } from 'eslint';
import boundariesImport from 'eslint-plugin-boundaries';
import eslintComments from '@eslint-community/eslint-plugin-eslint-comments/configs';
import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import { defineConfig } from 'eslint/config';
import tseslint from 'typescript-eslint';

/** A union of string literals is a set of values without a name; ADR 0006 point 3 wants an enum or an `as const` object. */
const stringUnion = {
	selector: 'TSUnionType > TSLiteralType > Literal[raw=/^[\'"]/], TSUnionType > TSLiteralType > TemplateLiteral',
	message:
		'A set of values has one named place: an enum in product code, a frozen `as const` object in tooling (ADR 0006 point 3).',
};

/** The core decides without the clock, randomness or plain errors (core rule). */
const coreOnly = [
	{
		selector:
			"NewExpression[callee.name='Date'], CallExpression[callee.name='Date'], MemberExpression[object.name='Date']",
		message: 'Time comes through a clock port (core rule).',
	},
	{
		selector: "MemberExpression[object.name='Math'][property.name='random']",
		message: 'IDs and tokens come from an adapter (core rule).',
	},
	{
		selector:
			'ThrowStatement > NewExpression[callee.name=/^(Aggregate|Eval|Range|Reference|Syntax|Type|URI)?Error$/], ThrowStatement > CallExpression[callee.name=/^(Aggregate|Eval|Range|Reference|Syntax|Type|URI)?Error$/]',
		message: 'Throw a core exception with a key (core rule).',
	},
	{
		// The zone rule resolves only plain strings, so a computed module name would slip past it.
		selector: 'ImportExpression > :not(Literal)',
		message: 'The core loads no module at runtime; an adapter does (core rule).',
	},
];

/** The parts of the hexagon (ADR 0011, 0019, 0020) as folders; the first folder a file lies in decides its part, so the
 * core's own files fall to `core-entry` only when no layer folder holds them. */
// The package is CommonJS but types itself as an ES module: at runtime the default import is the plugin, while the
// compiler sees a module namespace. The runtime value is measured, so it gets the plugin type ESLint defines.
const boundaries = boundariesImport as unknown as ESLint.Plugin;

const elements = [
	{ type: 'core-domain', pattern: 'packages/core/src/domain' },
	{ type: 'core-port', pattern: 'packages/core/src/port' },
	{ type: 'core-exception', pattern: 'packages/core/src/application/exception' },
	{ type: 'core-service', pattern: 'packages/core/src/application/service' },
	{ type: 'core-entry', pattern: 'packages/core/src' },
	{ type: 'infrastructure', pattern: 'packages/infrastructure' },
	{ type: 'protocol', pattern: 'packages/protocol' },
	{ type: 'office-ui', pattern: 'apps/office-ui' },
	{ type: 'hexagon-app', pattern: 'apps/{company-server,companion,asset-pipeline}' },
];
const core = ['core-entry', 'core-domain', 'core-port', 'core-exception', 'core-service'];
const allow = (from: string, to: string[]): object => ({
	from: { element: { type: from } },
	allow: { to: { element: { types: { anyOf: to } } } },
});

/** Who may import whom; everything not allowed here is forbidden (ADR 0006 point 8, ADR 0018). */
const zones = [
	// A domain rule fails with a core exception and its key (ADR 0011 point 7), so the domain may import them.
	allow('core-domain', ['core-domain', 'core-exception']),
	allow('core-port', ['core-domain', 'core-port']),
	allow('core-exception', ['core-domain', 'core-exception']),
	allow('core-service', ['core-domain', 'core-port', 'core-exception', 'core-service']),
	allow('core-entry', core),
	// An outgoing adapter that talks to another part of Pixecutive sends the protocol's messages.
	allow('infrastructure', ['core-entry', 'infrastructure', 'protocol']),
	allow('protocol', ['protocol']),
	allow('hexagon-app', ['core-entry', 'infrastructure', 'protocol', 'hexagon-app']),
	allow('office-ui', ['protocol', 'office-ui']),
	{
		from: { element: { types: { anyOf: ['infrastructure', 'protocol', 'hexagon-app', 'office-ui'] } } },
		allow: { to: { module: { origin: 'external' } } },
	},
	{
		from: { element: { types: { anyOf: ['infrastructure', 'hexagon-app'] } } },
		allow: { to: { module: { origin: 'core' } } },
	},
	{
		from: { element: { types: { anyOf: core } } },
		disallow: { to: { module: { origin: 'external' } } },
		message: 'The core imports no package: frameworks, IO and libraries belong to an adapter (core rule).',
	},
	{
		from: { element: { types: { anyOf: [...core, 'office-ui'] } } },
		disallow: { to: { module: { origin: 'core' } } },
		message: 'No Node module here: the core touches no IO, and the office UI runs in the browser.',
	},
	{
		// The office UI has no link to these packages, so their imports would otherwise count as external and pass.
		from: { element: { type: 'office-ui' } },
		disallow: {
			to: {
				module: {
					source: [
						'@pixecutive/core',
						'@pixecutive/core/**',
						'@pixecutive/infrastructure',
						'@pixecutive/infrastructure/**',
					],
				},
			},
		},
		message:
			'The office UI never imports the core or an adapter; it speaks through the protocol (ADR 0011 point 4, ADR 0020).',
	},
	// Last, so a spec file anywhere may use the test runner the zones above would refuse it.
	{ from: { file: { categories: 'test' } }, allow: { to: { module: { source: 'vitest' } } } },
];

export default defineConfig(
	{ ignores: ['**/node_modules/**', '**/dist/**', '.claude/skills/**/*.html'] },
	js.configs.recommended,
	...tseslint.configs.strictTypeChecked,
	eslintComments.recommended,
	{
		languageOptions: {
			parserOptions: {
				projectService: true,
				tsconfigRootDir: import.meta.dirname,
			},
		},
		linterOptions: { reportUnusedDisableDirectives: 'error' },
		rules: {
			'@typescript-eslint/no-explicit-any': 'error',
			'@typescript-eslint/restrict-template-expressions': ['error', { allowNumber: true }],
			'@typescript-eslint/explicit-function-return-type': 'error',
			'@typescript-eslint/explicit-module-boundary-types': 'error',
			'@typescript-eslint/no-non-null-assertion': 'error',
			'@typescript-eslint/ban-ts-comment': ['error', { 'ts-expect-error': 'allow-with-description' }],
			'@eslint-community/eslint-comments/require-description': 'error',
			'no-restricted-syntax': ['error', stringUnion],
			'max-lines': ['error', { max: 400, skipBlankLines: true, skipComments: true }],
			'max-lines-per-function': ['error', { max: 120, skipBlankLines: true, skipComments: true }],
			complexity: ['error', 12],
		},
	},
	{
		files: ['{packages,apps}/**/*.{ts,tsx,mts,cts}'],
		plugins: { boundaries },
		settings: {
			'boundaries/elements': elements,
			'boundaries/files': [{ category: 'test', pattern: '**/*.spec.{ts,tsx,mts,cts}' }],
			'import/resolver': {
				typescript: {
					alwaysTryTypes: true,
					noWarnOnMultipleProjects: true,
					project: ['packages/*/tsconfig.json', 'apps/*/tsconfig.json'],
				},
			},
		},
		rules: {
			'boundaries/dependencies': ['error', { default: 'disallow', checkAllOrigins: true, policies: zones }],
			'boundaries/no-unknown-files': 'error',
		},
	},
	{
		files: ['packages/core/**/*.{ts,tsx,mts,cts}'],
		rules: { 'no-restricted-syntax': ['error', stringUnion, ...coreOnly] },
	},
	prettier,
);
