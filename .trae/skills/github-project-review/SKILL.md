---
name: github-project-review
description: Review GitHub repositories for promotion, launch, or open-source adoption readiness. Use when the user asks to evaluate a GitHub project, repo, or local clone for code quality, frontend or system architecture, product-market positioning, community readiness, security posture, DevOps maturity, CI/CD, dependency risk, or a structured go/no-go promotion report. Supports public and private repositories when gh CLI is authenticated. Includes a 7-role team collaboration protocol with shared memory, discovery-driven task passing, escalation support, and cross-session long-term memory.
---

# GitHub Project Review

Use this skill to run a structured multi-agent team review of a GitHub project before promotion, launch, community outreach, or investment of more engineering/marketing effort.

Seven roles work as a coordinated team: they share findings through a workspace, send task requests and escalations to each other based on what they discover, and produce a unified go/no-go report. A persistent long-term memory layer lets roles recall prior reviews of the same repo and accumulate cross-project experience.

Each role also has a persistent persona card in `roles/`. Read the relevant `roles/role-*.md` file before dispatching that role so its voice, memory style, handoff habits, and decision bias remain stable across reviews.

## Inputs

Accept any of these targets:

- `owner/repo`
- `https://github.com/owner/repo`
- A local clone path with a GitHub remote
- A local project path without a remote, with reduced GitHub metrics

If the target is ambiguous, ask for the repository before collecting data.

## Workflow

### Phase 1: Initialize

1. Resolve the target repository and check access (`gh auth status`).
2. Collect shared context:
   ```bash
   python scripts/collect_repo_context.py owner/repo --output repo-context.json
   ```
3. Initialize the team workspace:
   ```bash
   python scripts/team_workspace.py init --repo owner/repo --context repo-context.json
   ```
4. Load long-term memory so roles recall prior reviews and accumulated experience:
   ```bash
   python scripts/team_memory.py load --repo owner/repo
   ```
   Inject the returned `last_review` and `role_memory` into each role's prompt. If `has_prior_review` is true, roles should compare current state against the previous snapshot and note what changed.
5. Determine applicable roles. If the project has no frontend, mark Role B as N/A:
   ```bash
   python scripts/team_findings.py mark-na --role B
   ```

### Phase 2: Initial Analysis

Dispatch seven roles. Each role:
- Reads its own persona card from `roles/role-*.md` and keeps that role identity stable.
- Reads the shared context from `_context/repo-context.json`.
- Reads the long-term memory loaded in Phase 1 (prior review + role experience).
- Reads `references/evaluation-rubric.md` for scoring definitions.
- Performs its analysis and writes findings via `team_findings.py write`.
- If it discovers a reusable pattern worth remembering across projects, records it via `team_memory.py learn --role X --note "..."`.
- Checks escalation triggers (see below) and sends requests via `team_request.py send`.
- Checks for any incoming requests addressed to it and responds.

If multi-agent tools are available, dispatch all seven in the same tool call. Otherwise run sequentially.

**Each role must write findings in this JSON format:**
```json
{
  "scores": {
    "dimension_name": { "value": 7, "evidence": "specific file or pattern" }
  },
  "findings": [
    {
      "id": "X-001",
      "severity": "P0|P1|P2",
      "title": "Finding title",
      "evidence": "Specific file, line, or pattern",
      "files": ["path/to/file"],
      "recommendation": "What to fix"
    }
  ],
  "blockers": ["X-001"],
  "improvements_1w": ["..."],
  "improvements_1m": ["..."]
}
```

### Phase 3: Escalation Processing

After all initial roles complete:

1. Check team status:
   ```bash
   python scripts/team_status.py --format json
   ```
2. If `pending_escalations > 0`, dispatch the target role with an augmented prompt that includes the escalation context.
3. The target role processes the escalation, writes additional findings, and resolves it:
   ```bash
   python scripts/team_request.py resolve --id ESC-001 --resolution-summary "..." --resolution-finding-id G-005
   ```
4. Repeat until `team_status.py --check-complete` returns exit code 0.

### Phase 4: Cross-Role Review

Read `_synthesis/cross-findings.json` to identify contradictions or gaps that span multiple roles. If two roles disagree on severity, the coordinator notes both perspectives.

### Phase 5: Synthesis

1. Aggregate scores:
   ```bash
   python scripts/team_synthesis.py aggregate
   ```
2. Get report data:
   ```bash
   python scripts/team_synthesis.py report-data
   ```
3. Write the final report following `references/report-template.md`.
4. Archive the conclusion to long-term memory so future reviews of this repo can recall it:
   ```bash
   python scripts/team_memory.py save --repo owner/repo \
     --decision "可以推广" --overall-avg 7.8 --p0-count 0 --p1-count 2 \
     --summary "前端架构清晰，测试覆盖不足但无 P0 阻碍"
   ```

### Phase 6: Issue Filing (Optional)

If the test engineer (Role D) identified actionable test gaps and the user agrees:
```bash
python scripts/create_review_issues.py owner/repo --issues-file review-issues.json --dry-run
```

## Data Collection

Prefer the bundled collector:

```bash
python scripts/collect_repo_context.py owner/repo --output repo-context.json
```

For private repositories, run `gh auth status` first. If `gh` is missing or unauthenticated, set the `GITHUB_TOKEN` environment variable or provide a local clone.

The collector produces JSON with repository metadata, README, file tree summary, notable files, dependency/config files, recent commits, contributors, open issues, languages, recent PRs, and selected workflow/security files. Do not treat missing fields as zero quality; distinguish "not found", "not accessible", and "not applicable".

## Team Collaboration Protocol

### Memory Conventions

There are two memory layers:

**Session memory (`.github-review-workspace/`)** - per-review, deleted by `clean`:
- `_session.json` - session state, phase, role statuses
- `_context/` - shared collected data (read-only after Phase 1)
- `_mailbox/` - inter-role requests and escalations
- `_synthesis/` - aggregated scores and cross-findings
- `role-*/` - each role's findings and notes

**Long-term memory (`.github-review-memory/`)** - persistent across reviews, never auto-deleted:
- `repo-profiles/<owner__repo>/last-review.json` - most recent review snapshot for a repo
- `repo-profiles/<owner__repo>/history.jsonl` - append-only timeline of all past reviews
- `role-memory/role-<x>-<name>.md` - each role's accumulated cross-project experience notes

All read/write goes through the team scripts. Roles never edit JSON files directly.

### Long-Term Memory

- **Load** (Phase 1): `team_memory.py load --repo owner/repo` returns the prior review snapshot and each role's accumulated notes. Inject these into role prompts so roles "remember" what was found before.
- **Learn** (Phase 2, per role): when a role discovers a reusable pattern, `team_memory.py learn --role G --note "SQL concat in query builders is the most common P0 pattern seen so far" --source-repo owner/repo`.
- **Save** (Phase 5): `team_memory.py save` archives the decision, score, and summary as the repo's profile, overwriting `last-review.json` and appending to `history.jsonl`.
- **History** (any time): `team_memory.py history --repo owner/repo` prints the full review timeline for a repo.

The long-term memory directory is independent of the session workspace. Running `team_workspace.py clean` does NOT delete it; it persists across reviews so roles accumulate experience over time.

### Escalation Triggers

Each role checks these conditions during analysis and escalates when triggered:

| Source | Trigger | Target | Priority |
|---|---|---|---|
| A | No SECURITY.md or branch protection | G | P0 |
| A | No test infrastructure | D | P1 |
| B | API calls with no error handling | C | P1 |
| B | Zero frontend tests | D | P1 |
| C | Auth endpoints with weak validation | G | P0 |
| C | SQL string concatenation | G | P0 |
| D | Critical path untested, needs context | B or C | P1 |
| D | No CI test enforcement | G | P1 |
| E | Security anti-patterns (secrets, eval, SQL concat) | G | P0 |
| E | Widespread inconsistency, no linting | B or C | P1 |
| F | README lacks install/demo path | E | P1 |
| F | No license for open-source promotion | G | P0 |
| G | Secrets committed to repo | E | P0 |
| Any | P0 finding overlapping another role's domain | That role | P0 |

For the full routing matrix and worked examples, read `references/collaboration-protocol.md`.

### Task Passing

Send a request via:
```bash
python scripts/team_request.py send --from A --to G --type escalation --priority P0 --subject "Deep security review: no branch protection" --context '{"finding_id": "A-002"}'
```

Request types: `task` (concrete action), `escalation` (must resolve before report), `info` (lightweight query).

### Role Completion

Every role must call `team_findings.py write` before finishing. Roles marked N/A must be explicitly marked via `team_findings.py mark-na`, not silently skipped.

## Execution Modes

### Multi-Agent (Parallel)

When sub-agent dispatch is available, send all seven roles in one batch. Each sub-agent gets the shared context and its role instructions. After all complete, process escalations by dispatching targeted sub-agents.

### Single-Agent (Sequential)

When running in a single context, execute each role one by one. For each role: read its instructions, read context, read long-term memory, perform analysis, write findings, send escalations. After all seven, do a second pass for pending escalations.

### Lightweight (No Scripts)

If Python scripts are unavailable, perform the workflow manually: maintain a mental model of each role's findings, track escalation requests between roles, and synthesize the report directly.

Detection: try `python scripts/team_workspace.py init --repo test/test`. If it fails, fall back to lightweight mode.

## Parallel Review Roles

### Role A: Planning Analyst (计划分析师)

Assess whether the project has a coherent plan, roadmap, and execution discipline. Review milestones, project board, issue labels, release cadence, changelog, and contributor coordination signals.

Required output:
- Scores for planning clarity, roadmap maturity, milestone discipline, and execution tracking.
- Whether the project has a clear short-term and medium-term direction.
- Gaps in planning artifacts.
- Recommended planning improvements.

Escalation triggers:
- No SECURITY.md or branch protection -> escalate to G (P0).
- No test infrastructure -> escalate to D (P1).

### Role B: Frontend Engineer (前端工程师)

Assess frontend architecture and engineering quality. Focus on framework choice, component structure, state/data boundaries, TypeScript or typing, build tooling, performance, accessibility, and maintainability. Skip gracefully if the project has no frontend.

Required output:
- Scores for frontend architecture, component quality, build and tooling, frontend performance, and accessibility/usability.
- 3-6 evidence-backed findings (cite specific files, configs, or patterns).
- Top frontend blockers before promotion.
- 1-week and 1-month frontend improvements.

Escalation triggers:
- API calls with no error handling -> escalate to C (P1).
- Zero frontend tests -> escalate to D (P1).

### Role C: Backend Engineer (后端工程师)

Assess backend or system architecture. Focus on module boundaries, API design, data model, error handling, observability, scalability, and release engineering. Skip gracefully if the project has no backend.

Required output:
- Scores for API design, data model, error handling, observability, and backend performance.
- 3-6 evidence-backed findings.
- Top backend blockers before promotion.
- 1-week and 1-month backend improvements.

Escalation triggers:
- Auth endpoints with weak validation -> escalate to G (P0).
- SQL string concatenation -> escalate to G (P0).

### Role D: Test Engineer (测试工程师)

Assess test coverage, test strategy, and quality gates. Review test files, test framework choice, critical path coverage, e2e tests, CI test execution, and test maintainability. If actionable test gaps are found, prepare structured issue descriptions.

Required output:
- Scores for test coverage, test strategy, CI test enforcement, and test maintainability.
- List of untested critical paths with specific file/function references.
- 3-6 evidence-backed findings.
- A list of recommended issues to file (title, body, severity label).

Escalation triggers:
- Critical path untested, needs architecture context -> info request to B or C (P1).
- No CI test enforcement -> escalate to G (P1).

### Role E: Code Reviewer (代码评审员)

Assess overall code quality across the codebase. Review coding conventions, naming, file organization, duplication, complexity, documentation density, and consistency. Identify code smells and anti-patterns.

Required output:
- Scores for code quality, consistency and conventions, documentation density, and technical debt level.
- 3-6 evidence-backed findings (cite specific files or patterns).
- Top code quality blockers before promotion.
- 1-week and 1-month code quality improvements.

Escalation triggers:
- Security anti-patterns (secrets, eval, SQL concat) -> escalate to G (P0).
- Widespread inconsistency suggesting no linting -> cross-validate with B or C (P1).

### Role F: Product and Market (产品与市场)

Assess whether the project is understandable, differentiated, useful, and ready for discovery by the intended audience. Review README clarity, problem framing, demo/install path, screenshots or examples, topic tags, license, roadmap, community files, issues, contributors, and signals of momentum.

Required output:
- Scores for product positioning, differentiation, growth potential, community readiness, and product maturity.
- Primary target users and likely adoption triggers.
- Missing trust or conversion assets.
- Promotion channel suggestions and launch narrative.

Escalation triggers:
- README lacks install/demo path -> info request to E (P1).
- No license for open-source promotion -> escalate to G (P0).

### Role G: Security and DevOps (安全与运维)

Assess whether the project can be safely promoted without exposing users or maintainers to avoidable risk. Review workflows, secrets handling, dependency posture, lockfiles, container/deploy config, auth boundaries, input validation, release process, license/compliance files, and security documentation.

Required output:
- Scores for CI/CD maturity, application security, dependency hygiene, infrastructure safety, and compliance documentation.
- P0/P1 security or operational risks.
- CI/CD gate recommendations.
- Safe promotion prerequisites.

Escalation triggers:
- Secrets committed to repo -> cross-validate with E (P0).
- Missing lockfile or outdated dependencies -> info request to C (P1).

**Incoming escalation handling**: Role G may receive escalations from A, C, D, E, or F. Process each escalation by doing a focused deep-dive on the specific concern, write findings, and resolve the escalation via `team_request.py resolve`.

## Issue Filing

The test engineer (Role D) may identify actionable gaps that warrant GitHub issues:

```bash
python scripts/create_review_issues.py owner/repo --issues-file review-issues.json
```

The `review-issues.json` file should be an array of objects with `title`, `body`, and `labels` fields. The script uses `gh` CLI or `GITHUB_TOKEN` and supports `--dry-run` to preview without creating issues. Always ask the user for confirmation before filing issues.

## Synthesis Rules

- Use the user's language for the final report; default to Chinese.
- Keep the main report concise, usually under 3,000 Chinese characters unless the user asks for depth.
- Lead with go/no-go readiness, then evidence.
- Do not average scores blindly. Weight P0 blockers heavily in the final conclusion.
- Every score must cite repository evidence, such as a file, config, issue pattern, missing artifact, or metadata signal.
- Be explicit when evidence is unavailable due to API limits, missing auth, or local-only analysis.
- For private repositories, avoid exposing secrets or long proprietary code snippets in the report.
- When a role is not applicable (e.g., frontend for a CLI-only project), note it as "not applicable" and exclude it from the final average.
- Include an escalation history section if any escalations were processed.
- If long-term memory was loaded, note what changed since the prior review.

## Promotion Decision

Use this decision language:

- "可以推广": no P0 blockers, core story is clear, installation/demo path works or is credible.
- "小范围试推广": promising but has P1 quality, documentation, or operational gaps.
- "暂不建议推广": P0 blockers exist, core value is unclear, or safety/reliability risks are high.

## Failure Handling

If GitHub data cannot be collected, proceed with any local files or user-provided context and mark the report as limited. If a role lacks applicable evidence, adapt the dimension instead of forcing a frontend-only checklist onto a non-frontend repository. If a role is entirely inapplicable (e.g., frontend for a pure CLI tool), skip it and note the exclusion.

If workspace scripts fail, fall back to lightweight mode: track findings in your working memory, handle escalations inline, and synthesize the report directly.

If long-term memory is unavailable (script missing or first review of a repo), proceed without prior context; `load` returns `has_prior_review: false`.

## Reference Files

- `references/evaluation-rubric.md` - 1-10 scoring definitions for all 7 roles and P0/P1 examples.
- `references/report-template.md` - Final report Markdown template with 7 dimensions.
- `references/collaboration-protocol.md` - Detailed escalation routing matrix and worked examples.
- `roles/` - Stable persona cards for the seven long-running review roles.
