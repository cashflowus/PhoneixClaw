# ADR 001: Monorepo Structure

## Status

Accepted

## Context

Phoenix v2 comprises multiple services (API, dashboard, execution, automation, connector-manager, backtest-runner, skill-sync, agent-comm, global-monitor, ws-gateway), a shared codebase, OpenClaw configs and skills, and infrastructure. We need a clear way to organize these components and share code.

## Decision

Use a monorepo with the following top-level structure:

- `apps/` — User-facing applications (API, dashboard)
- `services/` — Backend services (execution, automation, ws-gateway, etc.)
- `shared/` — Shared code (DB models, events, utils)
- `infra/` — Infrastructure (Docker Compose, scripts, observability)
- `openclaw/` — OpenClaw configs, skills, bridge, agent templates

## Consequences

- **Positive**: Single CI/CD pipeline, shared dependencies, atomic cross-service changes, simpler local development
- **Negative**: Larger repo size, need for clear ownership and conventions
- **Mitigation**: Use path-based workspaces, enforce lint/format rules, document structure in README
