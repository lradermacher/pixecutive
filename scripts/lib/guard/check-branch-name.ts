// check-branch-name.ts — rejects a branch whose name does not carry its card.

const branchName = /^(feat|fix|chore|docs|refactor|test|build|ci)\/pix-\d+-[a-z0-9]+(-[a-z0-9]+)*$/;

/** Returns a finding when `branch` is not `<type>/pix-NNN-short`, the form every card's branch takes; else null. */
export function checkBranchName(branch: string): string | null {
	return branchName.test(branch)
		? null
		: `branch '${branch}' does not carry its card — name it <type>/pix-NNN-short, e.g. feat/pix-42-office-map`;
}
