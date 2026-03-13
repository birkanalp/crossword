Launch the design-review subagent to conduct a full 7-phase design audit of the running admin panel.

## Instructions for the agent

1. Read `.cursor/context/design-principles.md` or `.claude/context/design-principles.md` for Bulmaca-specific design standards
2. Use `mcp_task` with `subagent_type: design-review` OR use Playwright MCP directly to navigate to **http://localhost:3001** (or the URL provided by the user)
3. Conduct all 7 review phases: Preparation → Interaction Testing → Responsiveness → Visual Polish → Accessibility → Robustness → Code Health
4. Take screenshots at each phase to document findings
5. Produce the full structured Design Review Report with severity-tagged findings

## Working directory
/Users/birkanalp/Desktop/Bulmaca

## Target URL
$ARGUMENTS (default: http://localhost:3001)

If the admin is not running, first start it:
```bash
cd /Users/birkanalp/Desktop/Bulmaca/admin && npm run dev &
```
Then wait 3 seconds and proceed with the review.
