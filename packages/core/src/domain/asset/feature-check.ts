// feature-check.ts — how a feature of a character spec is checked on a rendered reference.

/** How a feature is checked: not at all, or by the local vision model. */
export enum FeatureCheck {
	None = 'none',
	Vision = 'vision',
}
