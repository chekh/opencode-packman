# Code Review Report

## 1. Review Scope
- Target: working_tree | branch_vs_base | provided_diff
- Base branch: <if any>
- Reviewed at: <timestamp>
- Reviewer style: Critical (Linus-style)
- Diff source:

## 2. Intent & Context Understanding
- Intended goal:
- Background:
- Assumptions:
- Missing context / questions:

## 3. Executive Summary
- Overall assessment: ✅ Acceptable / ⚠️ Needs changes / ❌ Blocked
- Architecture/design verdict:
- Correctness verdict:
- Risk level:
- High risk areas:
- Test confidence:

## 4. Review Checklist
- [ ] Is the change purpose and business context clear?
- [ ] Is the design minimal, coherent, and evolvable?
- [ ] Are module boundaries clean without unnecessary coupling?
- [ ] Is correctness solid for edge/error/rollback paths?
- [ ] Are there no race/deadlock/starvation risks?
- [ ] Is there no memory/connection/file-handle leak risk?
- [ ] Is complexity and critical-path performance acceptable?
- [ ] Are security controls and data handling adequate?
- [ ] Is test coverage sufficient (unit/integration/regression/concurrency/perf)?
- [ ] Are readability and code consistency acceptable?
- [ ] Is operability adequate (logging/monitoring/alerting/debuggability)?
- [ ] Are compatibility, migration, and rollback risks addressed?

## 5. Findings (with file and line)
| Severity | File | Line(s) | Category | Issue | Why it matters | Recommendation |
|---|---|---:|---|---|---|---|
| high | src/foo.ts | 120-148 | Correctness | ... | ... | ... |

## 6. Test Coverage Review
- Existing tests reviewed:
- Coverage gaps:
- Suggested tests:
- Regression tests required before merge:

## 7. Action Items
- [ ] [critical/high/medium/low] `path:line-range` Action description (owner: ?, ETA: ?)

## 8. Optional Patch Suggestions
```diff
# Minimal safe fix examples
```

## 9. Merge Recommendation
- Decision: ✅ Merge / ⚠️ Merge with follow-ups / ❌ Block
- Required before merge:
- Nice-to-have follow-ups:
