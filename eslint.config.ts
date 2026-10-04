import eslintComments from '@eslint-community/eslint-plugin-eslint-comments/configs';
import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import { defineConfig } from 'eslint/config';
import tseslint from 'typescript-eslint';

/** A union of string literals is a set of values without a name; ADR 0006 point 3 wants an enum or an `as const` object. */
const stringUnion = {
	selector: 'TSUnionType > TSLiteralType > Literal[raw=/^[\'"]/]',
	message:
		'A set of values has one named place: an enum in product code, a frozen `as const` object in tooling (ADR 0006 point 3).',
};

/** The core decides without the clock, randomness or plain errors (core rule). */
const coreOnly = [
	{ selector: "NewExpression[callee.name='Date']", message: 'Time comes through a clock port (core rule).' },
	{ selector: "MemberExpression[object.name='Date']", message: 'Time comes through a clock port (core rule).' },
	{
		selector: "MemberExpression[object.name='Math'][property.name='random']",
		message: 'IDs and tokens come from an adapter (core rule).',
	},
	{
		selector: "ThrowStatement > NewExpression[callee.name='Error']",
		message: 'Throw a core exception with a key (core rule).',
	},
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
		files: ['packages/core/**/*.ts'],
		rules: { 'no-restricted-syntax': ['error', stringUnion, ...coreOnly] },
	},
	prettier,
);
