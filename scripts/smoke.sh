#!/usr/bin/env bash

set -euo pipefail

repo_root="$(cd "$(dirname "$0")/.." && pwd)"
tmp_dir="$(mktemp -d "/tmp/opm-smoke-XXXXXX")"

cleanup() {
  rm -rf "$tmp_dir"
}
trap cleanup EXIT

echo "[smoke] repo: $repo_root"
echo "[smoke] temp project: $tmp_dir"

pnpm --dir "$repo_root" build
pnpm --dir "$repo_root" test
pnpm --dir "$repo_root" lint

pushd "$tmp_dir" >/dev/null
pnpm --dir "$repo_root" --filter @opencode-packman/cli dev -- init
pnpm --dir "$repo_root" --filter @opencode-packman/cli dev -- preview "$repo_root/examples/packages/backend-review"
pnpm --dir "$repo_root" --filter @opencode-packman/cli dev -- install "$repo_root/examples/packages/backend-review" --yes
pnpm --dir "$repo_root" --filter @opencode-packman/cli dev -- doctor

test -f "$tmp_dir/.opencode/agents/code-reviewer.md"
test -f "$tmp_dir/.opencode/commands/review.md"
test -f "$tmp_dir/.opencode/skills/api-review/SKILL.md"
test -f "$tmp_dir/.opencode-packman/lock.yaml"

pnpm --dir "$repo_root" --filter @opencode-packman/cli dev -- remove backend-review --yes
pnpm --dir "$repo_root" --filter @opencode-packman/cli dev -- doctor
popd >/dev/null

echo "[smoke] ok"
