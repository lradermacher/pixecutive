// secret-patterns.ts — the patterns of the secret scan, one place for pre-commit and pre-push.
// cspell:ignore whsec pousr glpat xox abprs changeme

/** Keys and tokens, plain-text password fallbacks, and the generated paths the scan skips. */
export const secretPatterns = {
	secret: new RegExp(
		[
			'BEGIN (RSA |OPENSSH |EC |DSA |PGP )?PRIVATE KEY',
			'AKIA[0-9A-Z]{16}',
			'sk_live_[0-9a-zA-Z]{20,}',
			'rk_live_[0-9a-zA-Z]{20,}',
			'whsec_[0-9a-zA-Z]{20,}',
			'gh[pousr]_[0-9a-zA-Z]{30,}',
			'github_pat_[0-9a-zA-Z_]{22,}',
			'glpat-[0-9a-zA-Z_-]{20,}',
			'sk-ant-[0-9a-zA-Z_-]{20,}',
			'sk-proj-[0-9a-zA-Z_-]{20,}',
			'xox[abprs]-[0-9a-zA-Z-]{10,}',
			'AIza[0-9A-Za-z_-]{35}',
		].join('|'),
	),
	fallback: /(\?\?|\|\|)\s*'(change_me|changeme|secret|password|test123)'/,
	localPath: /(\/Users\/|\/home\/)[A-Za-z0-9._-]+\/|[A-Za-z]:\\Users\\[A-Za-z0-9._-]+/,
	skip: /((^|\/)(package-lock\.json|pnpm-lock\.yaml|yarn\.lock)|\.lock)$/,
} as const;
