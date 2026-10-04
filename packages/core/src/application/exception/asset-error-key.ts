// asset-error-key.ts — the keys under which asset failures are reported; each edge translates them into its answer.

/** Why an asset step failed. */
export enum AssetErrorKey {
	InvalidData = 'asset.invalid-data',
	ForbiddenPrompt = 'asset.forbidden-prompt',
	NoPassingReference = 'asset.no-passing-reference',
}
