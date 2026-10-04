// assetExceptionKey.enum.ts — stable keys for asset failures; each edge translates them into its own answer.

/** Why an asset step failed. */
export enum AssetExceptionKey {
	InvalidData = 'asset.invalid_data',
	ForbiddenPrompt = 'asset.forbidden_prompt',
	NoPassingReference = 'asset.no_passing_reference',
}
