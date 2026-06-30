# AGENTS.md

## Communication

- Default to Chinese unless the task clearly needs another language.
- Give the conclusion directly; avoid unnecessary pleasantries.
- For complex tasks, report progress in short stages.
- For decision-oriented questions, provide 2-3 options and clearly recommend one.
- If blocked by permissions, missing data, or tool limits, say so early instead of repeatedly retrying.
- For information-heavy conclusions, state the basis: local file, data, inference, or web source.
- Make conclusions defensible. Avoid vague judgments without evidence.

## Project

Life Service Onboarding Quest is a PDE project for turning a new-hire product experience assignment into a reusable, game-like onboarding platform.

The first business theme is Douyin Life Service review production and review-assisted consumption.

## Current Product Direction

This is not a document-only workflow. The project should be treated as a product and engineering deliverable:

- PRD and product scope
- Technical design
- Web MVP
- Iterative testing
- Later deployment and AI/Game Master integration

Feishu documents can be used for report output and stakeholder communication, but the core user interaction should happen in the web product.

## User Role Context

The user is a Douyin Life Service product manager focused on review production:

- Place reviews and product reviews
- Review production path and tools
- Review content quality
- Incentives and campaigns for review production
- Review distribution across user-side and merchant-side scenes

## Project Principles

- Build the actual usable experience, not only strategy documents.
- Keep the MVP lightweight and testable.
- Use structured levels, submissions, report cards, and final reports.
- Treat AI as Game Master, coach, evaluator, and report drafter.
- Do not fabricate user observations. AI can organize and question, but the user must provide real experience evidence.

## PDE Workflow

For substantial changes, follow this loop:

1. Clarify the goal and current phase.
2. Update PRD or technical design if the product scope changes.
3. Implement the smallest usable slice.
4. Verify locally.
5. Record what changed and what should happen next.

## Execution Rules

- Check local files, context, and available tools before asking questions.
- If a request is ambiguous and a wrong assumption would cause high rework or risk, confirm the target in one sentence before proceeding.
- If a technical path fails three times, switch approach and explain why.
- For business or analysis tasks, prefer: problem -> evidence/scale -> recommendation -> risks/validation.
- Do not over-PRD business thinking. Use Why and So What before How unless implementation details are explicitly requested.
- Treat this as a product and engineering project: update docs only when the product scope or implementation contract changes.

## Current Deliverables

- `docs/PRD.md`
- `docs/TECH_SPEC.md`
- `docs/PDE_PLAYBOOK.md`
- `docs/WORKING_GUIDE.md`
- `app/page.tsx`
- `app/globals.css`
- `lib/quest.ts`
- `config/levels.yaml`
- `runs/trial_01.md`

## Next Product Priorities

1. Make the web MVP support the first real trial data.
2. Improve report card generation from rule-based draft to AI-assisted coaching.
3. Add a leader review mode.
4. Add Feishu sync for final report output.
5. Prepare deployment path after the MVP interaction is stable.

## Engineering Notes

- Current MVP uses Next.js App Router and keeps browser `localStorage` as the persistence layer.
- Keep the app lightweight; do not introduce backend persistence until multi-user review is required.
- If deployment is needed, prefer static hosting first.
- If persistence or multi-user review is needed, introduce a backend or database later.

## Safety

- Do not ask for or handle cookies, tokens, private keys, passwords, or other credentials.
- Do not upload, forward, publish, or publicly share company/internal materials without explicit confirmation.
- Confirm before any external send, upload, publish, or sharing action.
- Treat sensitive or non-redacted materials as local-only: summarize and abstract methods locally rather than moving them to external systems.
- Confirm before deleting, overwriting, or bulk-moving user files.
