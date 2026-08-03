# How to run this

1. Copy this whole `niranthara-multiagent/` folder into the root of your Niranthara repo (merge the
   `.claude/` folder and `CLAUDE.md` with anything you already have).
2. Open a terminal in the repo and start Claude Code: `claude`
3. Confirm you're on Opus for the main session (it's set in `.claude/settings.json`, or run `/model
   opus` to be sure).
4. Paste the prompt below, filling in the `<...>` part with what you actually want built this cycle.
5. When it finishes, read `/docs/plans/retro-<date>.md` before starting the next cycle — that's
   deliberately how continuity across cycles is supposed to work here, instead of you re-explaining
   context every time.

---

## The prompt to paste

```
We're running a full build cycle on Niranthara using the team structure defined in CLAUDE.md and
.claude/agents/. You are the team lead, running on Opus. Spawn and coordinate the named teammates
(architect, product-strategist, code-reviewer, backend-engineer, ai-ml-engineer,
mobile-frontend-engineer, qa-tester, devops-deploy) as an agent team — they should message each
other directly and review each other's work, not just report to you in isolation.

This cycle's goal: <describe what you want built — e.g. "a check-in flow where the risk engine
flags a possible crisis signal from a journal entry, and the mobile app surfaces an appropriate,
non-alarming escalation prompt in Tamil and English">

Run the full workflow from CLAUDE.md:
1. architect does a literature/prior-art pass and product-strategist scopes the problem —
   in parallel, they should share findings with each other before either finalizes.
2. architect writes the plan to /docs/plans/, product-strategist reviews it against scope and
   success criteria before implementation starts.
3. backend-engineer, ai-ml-engineer, and mobile-frontend-engineer implement in parallel against
   the plan's interfaces.
4. code-reviewer reviews every diff before it's called done — implementers must address feedback
   and get explicit sign-off, not just move on.
5. qa-tester tests against the plan's success criteria, not just the code.
6. devops-deploy writes the runbook.
7. You write the retro to /docs/plans/retro-<date>.md.

Constraints:
- Treat crisis-detection accuracy and data privacy as non-negotiable — flag any tradeoff involving
  those to me directly rather than deciding silently.
- Keep me updated at each phase boundary (plan ready, implementation done, review complete, tests
  passed) rather than going silent until the whole cycle finishes — I want visibility, not just a
  final report.
- If any teammate hits a decision that's really mine to make (product direction, what to cut for
  time), stop and ask instead of guessing.
```

---

## Notes on the settings

- `.claude/settings.json` sets `"model": "opus"` for the lead session and enables Agent Teams via
  `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS`. Agent Teams is what gives you actual teammate-to-teammate
  communication and review — plain subagents can only report back to the lead, they can't message
  each other, which is why teams (not subagents) is the right fit for what you asked for.
- Each file in `.claude/agents/` sets its own `model:` — `opus` for the three roles whose judgment
  quality matters most (architect, product-strategist, code-reviewer), `sonnet` for the four
  implementation/execution roles. You can override any single one for a session by asking the lead
  to "run backend-engineer on opus for this" if a piece turns out to be unusually gnarly.
- Agent Teams is still experimental in Claude Code — expect occasional rough edges (a teammate
  stalling, task-list state lagging). If a teammate goes quiet, you can message it directly without
  going through the lead.
- Costs scale with how many teammates run in parallel and how much they message each other — for a
  quick fix, just talk to the main Opus session directly rather than spinning up the full team.
