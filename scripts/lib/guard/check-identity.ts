// check-identity.ts — rejects an author or committer mail that git derived from the machine.

import { execFileSync } from 'node:child_process';
import { hostname } from 'node:os';

const machineDomains = /(\.local|\.lan|\.home|\.internal|\.localdomain|\.fritz\.box|\(none\)|^localhost)$/;

function identity(role: 'AUTHOR' | 'COMMITTER'): string {
	try {
		const ident = execFileSync('git', ['var', `GIT_${role}_IDENT`], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
		return (/<([^>]*)>/.exec(ident)?.[1] ?? '').toLowerCase();
	} catch {
		return '';
	}
}

/**
 * Returns one finding per role whose mail is missing, has no real domain, was derived from the host name, or is not
 * in `allowed` when that list is not empty. Without an explicit user.email, git builds one from user and host name,
 * and that mail would stay in the public history forever.
 */
export function checkIdentity(allowed: readonly string[]): string[] {
	const host = hostname().toLowerCase();
	const shortHost = host.split('.')[0] ?? host;
	const findings: string[] = [];
	for (const role of ['AUTHOR', 'COMMITTER'] as const) {
		const name = role.toLowerCase();
		const mail = identity(role);
		const domain = mail.split('@')[1] ?? '';
		if (mail === '' || domain === '') findings.push(`${name} mail is missing — set it: git config user.email <address>`);
		else if (!domain.includes('.')) findings.push(`${name} mail <${mail}> has no real domain — set it: git config user.email <address>`);
		else if (machineDomains.test(domain)) findings.push(`${name} mail <${mail}> was derived from the machine — set it: git config user.email <address>`);
		else if (domain === host || domain.split('.')[0] === shortHost) findings.push(`${name} mail <${mail}> carries this machine's host name`);
		else if (allowed.length > 0 && !allowed.includes(mail)) findings.push(`${name} mail <${mail}> is not listed in historyGuard.authors`);
	}
	return findings;
}
