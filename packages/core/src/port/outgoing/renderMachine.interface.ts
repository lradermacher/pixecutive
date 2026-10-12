// renderMachine.interface.ts — what this machine offers a local render before the configuration is parsed.

/**
 * Where the repo lies, where the model's command and its weights usually are, and whether a configured file exists;
 * which model and which weights stays the adapter's knowledge.
 */
export interface IRenderMachine {
	repoRoot(): string;
	usualModelCommand(): string;
	/** The weights in `cache` when given, otherwise in the machine's usual cache; none when neither holds them. */
	cachedWeights(cache?: string): string | undefined;
	exists(path: string): boolean;
}
