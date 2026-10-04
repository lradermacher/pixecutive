import { defineConfig } from 'vitest/config';

/** One Vitest project per workspace package, so `pnpm test` runs every package with its own environment. */
export default defineConfig({
	test: {
		projects: ['packages/*', 'apps/*'],
	},
});
