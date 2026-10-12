// renderMachine.interface.ts — what this machine offers a local render before the configuration is parsed.

/** Where the repo lies, where mflux and the cached LoRA usually are, and whether a configured file exists. */
export interface IRenderMachine {
	repoRoot(): string;
	usualMflux(): string;
	cachedLora(): string | undefined;
	exists(path: string): boolean;
}
