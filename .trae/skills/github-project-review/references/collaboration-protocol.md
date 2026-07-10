# Collaboration Protocol

Detailed escalation routing rules, task passing conventions, and worked examples for the 7-role review team.

## Escalation Routing Matrix

Each role has specific conditions under which it should escalate findings to other roles.

| Source | Trigger Condition | Target | Type | Priority |
|---|---|---|---|---|
| A (Planning) | No SECURITY.md or no branch protection visible | G (Security) | deep-dive | P0 |
| A (Planning) | No test infrastructure or test-related milestones | D (Testing) | gap-fill | P1 |
| A (Planning) | No release cadence or changelog | F (Product) | info | P2 |
| B (Frontend) | API calls with no error handling pattern | C (Backend) | cross-validate | P1 |
| B (Frontend) | Zero frontend tests found | D (Testing) | gap-fill | P1 |
| B (Frontend) | No accessibility patterns or ARIA usage | F (Product) | info | P2 |
| C (Backend) | Auth endpoints with weak or no validation | G (Security) | deep-dive | P0 |
| C (Backend) | Database queries with string concatenation | G (Security) | deep-dive | P0 |
| C (Backend) | No error handling middleware or patterns | E (Code Review) | cross-validate | P1 |
| D (Testing) | Critical path untested, need architecture context | B or C | info | P1 |
| D (Testing) | No CI enforcement of tests | G (Security) | cross-validate | P1 |
| D (Testing) | Test infrastructure exists but coverage is zero on key modules | B or C | info | P1 |
| E (Code Review) | Security-sensitive anti-patterns (SQL concat, hardcoded secrets, eval) | G (Security) | deep-dive | P0 |
| E (Code Review) | Widespread inconsistency suggesting no linting or formatting | B or C | cross-validate | P1 |
| F (Product) | README lacks install/demo path | E (Code Review) | info | P1 |
| F (Product) | No license file for open-source promotion | G (Security) | deep-dive | P0 |
| G (Security) | Secrets committed to repo | E (Code Review) | cross-validate | P0 |
| G (Security) | Missing lockfile or outdated dependencies | C (Backend) | info | P1 |
| Any role | P0 finding that overlaps another role's domain | That role | deep-dive | P0 |

## Request Types

### task
A concrete action for the target role to perform. The target role should incorporate it into its analysis and produce a finding.

**When to use**: "Please analyze the auth module's error handling" — the target role needs to do work and return results.

**Priority rules**:
- P0: Must be completed before synthesis.
- P1: Should be completed; if not, note the gap in the report.
- P2: Best effort; can be deferred.

### escalation
A high-severity finding that requires the target role to do a deeper investigation on a specific concern. Escalations carry more weight and must be resolved before the report is generated.

**When to use**: "I found that there's no branch protection and no SECURITY.md — please do a deep security review of access controls."

**Priority rules**:
- P0: Mandatory. Must be resolved before synthesis.
- P1: Strongly recommended. Should be resolved.
- P2: Rarely used for escalations.

### info
A lightweight information request. The target role provides context or confirms a detail without doing deep analysis.

**When to use**: "Can you confirm the component structure of Dashboard.tsx? I need it for test gap analysis."

**Priority rules**:
- All info requests are best-effort and do not block synthesis.

## Worked Example: Escalation Flow

### Scenario: E-commerce project with weak security

**Phase 1 — Initial Analysis**

1. Role A (Planning) analyzes milestones and finds no SECURITY.md, no branch protection mentioned anywhere.
   - Role A writes findings with `A-002` as P0: "No security policy or branch protection artifacts found."
   - Role A sends escalation: `--from A --to G --type escalation --priority P0 --subject "Deep security review: no SECURITY.md or branch protection"`

2. Role E (Code Reviewer) scans the codebase and finds `src/api/users.ts` line 45: `const query = "SELECT * FROM users WHERE id = " + req.params.id`.
   - Role E writes finding `E-003` as P0: "SQL injection vulnerability in user API."
   - Role E sends escalation: `--from E --to G --type escalation --priority P0 --subject "SQL injection at src/api/users.ts:45"`

3. Role D (Test Engineer) finds zero tests on any API route, but needs to know the API structure to recommend specific test cases.
   - Role D sends info: `--from D --to C --type info --priority P1 --subject "API route structure for test recommendations"`

**Phase 2 — Escalation Processing**

The coordinator runs `team_status.py` and sees:
```
Roles: 7/7 applicable completed
Pending escalations: 2
  ESC-001: A -> G (P0) "Deep security review..."
  ESC-002: E -> G (P0) "SQL injection at src/api/users.ts:45"
Pending requests: 1 (info, non-blocking)
Ready for synthesis: NO
```

The coordinator dispatches Role G with:
- Standard Role G instructions
- Shared context
- **Plus**: escalation ESC-001 (from A) and ESC-002 (from E)

Role G performs deep security analysis, writes new findings (`G-005`, `G-006`), and resolves both escalations:
```bash
team_request.py resolve --id ESC-001 --resolution-summary "Confirmed: no branch protection, direct push to main allowed." --resolution-finding-id G-005
team_request.py resolve --id ESC-002 --resolution-summary "Confirmed SQL injection, elevated to P0 blocker with additional auth bypass vectors found." --resolution-finding-id G-006
```

**Phase 3 — Synthesis**

`team_status.py --check-complete` now returns 0. The coordinator runs `team_synthesis.py report-data` to get all findings, scores, and escalation history for the final report.

## Edge Cases

### Target role is N/A
If the target role has been marked as not applicable (e.g., frontend role for a CLI project), the escalation is automatically dropped. The coordinator should log this in the report as "escalation to N/A role, dropped."

### Mutual escalation
Two roles may escalate each other (e.g., Security and Code Review). This is handled by processing escalations in order of creation. Each role processes incoming escalations during its re-dispatch, without creating an infinite loop. The coordinator limits escalation depth to 2 rounds.

### Unresolvable escalation
If a target role cannot resolve an escalation (e.g., insufficient data), the coordinator marks it as "unresolvable" after the second round. Unresolvable escalations become findings in the final report under a "Known Gaps" section.

### Timeout
If a role takes too long (implementation-defined), the coordinator may skip it and note the exclusion in the report.

## Workspace File Conventions

| File | Purpose | Writer | Readers |
|---|---|---|---|
| `_session.json` | Session state and role status | team_workspace.py, team_findings.py | All scripts |
| `_context/repo-context.json` | Collected repository data | collect_repo_context.py | All roles (read-only) |
| `_mailbox/requests.json` | Inter-role requests | team_request.py | team_status.py, coordinator |
| `_mailbox/escalations.json` | Escalation log | team_request.py | team_status.py, coordinator |
| `_synthesis/scores.json` | Aggregated scores | team_synthesis.py | Coordinator |
| `_synthesis/cross-findings.json` | P0/P1 findings across roles | team_findings.py | team_synthesis.py |
| `role-*/findings.json` | Role's structured output | team_findings.py | Other roles, team_synthesis.py |
| `role-*/notes.md` | Role's narrative analysis | The role itself | Coordinator (for report) |
