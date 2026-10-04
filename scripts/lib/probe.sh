# probe.sh — the frame every scripts/probe-*.sh sources: throwaway repos, cases that must turn red or green, a summary.
# Called from a git hook, a probe inherits the committing repo's index, directory and identity; they are cleared here.
unset GIT_INDEX_FILE GIT_DIR GIT_WORK_TREE \
	GIT_AUTHOR_NAME GIT_AUTHOR_EMAIL GIT_AUTHOR_DATE GIT_COMMITTER_NAME GIT_COMMITTER_EMAIL GIT_COMMITTER_DATE

PROBE_PASS=0
PROBE_FAIL=0
PROBE_RESTORE="${PROBE_RESTORE:-yes}"
PROBE_CLEAN_EXCLUDES=()
work=""
PROBE_BASE_BRANCH=""
PROBE_BASE_SHA=""

# Counts one result and prints it; on a deviation the first lines of the case's output follow.
probe_record() {
	local label="$1" want="$2" got="$3" output="${4:-}"
	if [ "$got" = "$want" ]; then
		PROBE_PASS=$((PROBE_PASS + 1))
		printf '  ✅ %-62s %s\n' "$label" "$got"
	else
		PROBE_FAIL=$((PROBE_FAIL + 1))
		printf '  ⛔ %-62s %s, expected %s\n' "$label" "$got" "$want"
		[ -n "$output" ] && printf '%s\n' "$output" | head -8 | sed 's/^/        /'
	fi
	return 0
}

# Runs a command in the current directory: exit 0 is green, anything else red.
probe_case() {
	local label="$1" want="$2" cmd="$3" output got=green
	output="$(eval "$cmd" 2>&1)" || got=red
	probe_record "$label" "$want" "$got" "$output"
}

# Removes the throwaway tree on exit, plus whatever the probe's own probe_cleanup_extra removes.
probe_cleanup() {
	if [ -n "$work" ] && [ -d "$work" ]; then
		rm -rf "${work:?}"
	fi
	if declare -F probe_cleanup_extra >/dev/null; then
		probe_cleanup_extra
	fi
	return 0
}

# Creates an empty throwaway repo in $work; without a directory the probe stops instead of running in the real repo.
probe_tree_init() {
	local name="$1"
	work="$(mktemp -d "${TMPDIR:-/tmp}/probe-$name.XXXXXX")" || work=""
	if [ -z "$work" ] || [ ! -d "$work" ]; then
		echo "probe-$name.sh: no throwaway directory, aborted." >&2
		exit 1
	fi
	trap probe_cleanup EXIT
	git -C "$work" init -q || { echo "probe-$name.sh: git init failed." >&2; exit 1; }
}

# Commits everything in $work as the state every case returns to.
probe_tree_commit() {
	git -C "$work" add -A >/dev/null 2>&1
	git -C "$work" -c user.email=probe@example.com -c user.name=Probe commit -q --allow-empty -m base >/dev/null 2>&1 || {
		echo "probe: the starting state could not be recorded." >&2
		exit 1
	}
}

# Resets $work to the recorded state; an empty $work stops the probe, because git would clean the real repo instead.
probe_restore() {
	if [ -z "$work" ] || [ ! -d "$work/.git" ]; then
		echo "probe: throwaway tree is gone, aborted." >&2
		exit 1
	fi
	local excludes=() path
	for path in ${PROBE_CLEAN_EXCLUDES[@]+"${PROBE_CLEAN_EXCLUDES[@]}"}; do excludes+=(-e "$path"); done
	if [ -n "$PROBE_BASE_BRANCH" ] && [ -n "$PROBE_BASE_SHA" ]; then
		git -C "$work" checkout -q -f "$PROBE_BASE_BRANCH" 2>/dev/null || true
		git -C "$work" reset -q --hard "$PROBE_BASE_SHA" 2>/dev/null || true
	fi
	git -C "$work" checkout -q -- . 2>/dev/null || true
	git -C "$work" clean -q -f -d ${excludes[@]+"${excludes[@]}"} 2>/dev/null || true
	if declare -F probe_restore_extra >/dev/null; then
		probe_restore_extra
	fi
}

# Runs a case inside $work, records it, then resets $work unless PROBE_RESTORE=no.
probe() {
	local label="$1" want="$2" cmd="$3" output got=green
	if [ -z "$PROBE_BASE_SHA" ] && [ -d "$work/.git" ]; then
		PROBE_BASE_SHA="$(git -C "$work" rev-parse --verify -q HEAD 2>/dev/null || true)"
		[ -n "$PROBE_BASE_SHA" ] && PROBE_BASE_BRANCH="$(git -C "$work" symbolic-ref --short HEAD 2>/dev/null || true)"
	fi
	output="$(
		cd "$work" || exit 99
		export CLAUDE_PROJECT_DIR="$work"
		if declare -F probe_env >/dev/null; then probe_env; fi
		eval "$cmd" 2>&1
	)" || got=red
	probe_record "$label" "$want" "$got" "$output"
	if [ "$PROBE_RESTORE" = yes ]; then
		probe_restore
	fi
}

# Prints the summary and exits 1 on any deviation.
probe_done() {
	echo
	echo "$PROBE_PASS probes as expected, $PROBE_FAIL deviating."
	[ "$PROBE_FAIL" -eq 0 ]
}
