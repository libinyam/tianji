# Evaluation Rubric

Use 1-10 scores. Scores must include evidence, not impressions.

## Score Bands

- 1-3: serious blocker; promotion would likely create failed adoption, security risk, or reputational damage.
- 4-5: weak; usable only with narrow internal or experimental expectations.
- 6-7: acceptable baseline; can support limited promotion with clear caveats.
- 8-9: strong; ready for broader promotion with minor improvements.
- 10: exceptional; polished, well-evidenced, and low-risk for its project type.

## Planning Dimensions (Role A: Planning Analyst)

- Planning clarity: project goals, scope, and current phase are clearly stated in README, docs, or project board.
- Roadmap maturity: short-term and medium-term direction exists with actionable milestones or releases.
- Milestone discipline: milestones or project boards are used to track progress, with meaningful labels and states.
- Execution tracking: issues are triaged, labeled, and assigned; release cadence is visible; changelog or release notes exist.

## Frontend Engineering Dimensions (Role B: Frontend Engineer)

- Frontend architecture: framework choice, component structure, state/data boundaries, routing, and extensibility.
- Component quality: reusability, prop design, separation of concerns, consistent patterns.
- Build and tooling: build config, bundler, dev server, lint/format setup, TypeScript or typing discipline.
- Frontend performance: lazy loading, bundle size, runtime efficiency, caching, responsive behavior.
- Accessibility or usability: keyboard navigation, ARIA/semantics, error states, responsive behavior.

## Backend Engineering Dimensions (Role C: Backend Engineer)

- API design: clear endpoints, REST/GraphQL conventions, versioning, response shape, error responses.
- Data model: schema design, migrations, validation, indexing, query efficiency.
- Error handling: consistent error types, meaningful messages, graceful degradation, logging.
- Observability: logging, metrics, tracing, health checks, debuggability.
- Backend performance: caching, connection pooling, query optimization, scalability signals.

## Test Engineering Dimensions (Role D: Test Engineer)

- Test coverage: unit/integration/e2e presence, critical path coverage, coverage measurement.
- Test strategy: test pyramid balance, test isolation, fixture/data management, mocking strategy.
- CI test enforcement: tests run in CI, failure blocks merge, coverage gates, flaky test handling.
- Test maintainability: test readability, helper utilities, test data factories, naming conventions.

## Code Quality Dimensions (Role E: Code Reviewer)

- Code quality: readability, naming, file organization, duplication, complexity, error handling.
- Consistency and conventions: linting, formatting, style guide, pattern consistency across modules.
- Documentation density: inline comments, API docs, architecture docs, JSDoc/docstrings, README completeness.
- Technical debt: dead code, TODO/FIXME density, deprecated patterns, refactoring urgency.

## Product and Market Dimensions (Role F: Product and Market)

- Positioning clarity: target user, problem, outcome, and "why this exists" are easy to understand.
- Differentiation: credible contrast with alternatives, unique workflow, data, UX, cost, or community angle.
- Growth potential: shareability, SEO/discoverability, demo path, onboarding speed, topic relevance.
- Community readiness: license, contributing guide, issue templates, support expectations, governance signals.
- Product maturity: feature completeness, reliable happy path, roadmap clarity, release or changelog signals.

## Security and DevOps Dimensions (Role G: Security and DevOps)

- CI/CD maturity: automated tests, lint/type gates, branch/PR checks, release workflow, deployment discipline.
- Application security: auth boundaries, input validation, secret handling, safe defaults, abuse resistance.
- Dependency hygiene: lockfiles, dependency count, update cadence, known-risk packages, audit posture.
- Infrastructure safety: container/deploy config, headers, env management, least privilege, rollback path.
- Compliance documentation: license, security policy, privacy/data notes when relevant.

## P0 Blocker Examples

- No clear install/demo path for a project that needs users to try it.
- Missing license for an open-source promotion.
- Secrets committed or exposed in config.
- No safe auth/permission boundary in a project handling user data.
- Critical build, test, or startup path appears broken.
- README does not explain the problem, audience, or usage.
- No tests at all for a project handling financial, security, or user data.
- Critical path has zero test coverage and no CI enforcement.

## P1 Improvement Examples

- Sparse tests around important paths.
- Weak issue/PR templates.
- No screenshots, demo, or example output for a user-facing project.
- CI exists but lacks meaningful quality gates.
- Product differentiation is plausible but not stated.
- No milestones or project board for tracking progress.
- Inconsistent coding conventions across modules.
- Missing changelog or release notes.
- Frontend lacks accessibility considerations.
- No observability setup (logging, metrics, health checks).
