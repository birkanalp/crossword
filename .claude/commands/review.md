Launch the code-review subagent to conduct a pragmatic code review on the current git diff or specified files.

## Instructions for the agent

1. If $ARGUMENTS is empty, run `git diff HEAD` from `/Users/birkanalp/Desktop/Bulmaca` to get the current staged/unstaged diff
2. If $ARGUMENTS specifies files or a PR number, review those files
3. Evaluate all 7 dimensions: Architecture, Functionality, Security, Maintainability, Testing, Performance, Dependencies
4. Apply SOLID, DRY, KISS, YAGNI principles
5. Output the triage matrix with [Critical/Blocker], [Improvement], [Nit] findings
6. End with a clear APPROVE / REQUEST CHANGES / NEEDS DISCUSSION verdict

## Working directory
$CLAUDE_PROJECT_DIR = /Users/birkanalp/Desktop/Bulmaca

## Target
$ARGUMENTS (default: current git diff — `git diff HEAD`)

Tip: To review a specific file, pass the file path as argument. Example:
`/review admin/app/puzzles/[id]/page.tsx`
