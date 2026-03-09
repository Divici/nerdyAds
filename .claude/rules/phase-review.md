# Phase Completion Review

When a phase is marked as complete (or the user says a phase is done), perform a full review before moving on.

## Trigger

Any time a phase from `docs/implementation-plan.md` is finished — either explicitly stated by the user or when all planned work for that phase has been implemented and tests pass.

## Review Steps

1. **Read the phase spec** — Re-read the relevant phase section in `docs/implementation-plan.md`. List every file, feature, and test mentioned.

2. **Check implementation against plan** — For each item in the phase spec:
   - Does the file exist?
   - Does it export the functions/classes/types listed?
   - Are the tests listed in the plan actually written and passing?
   - Are there any items in the plan that were skipped or partially implemented?

3. **Check against the project brief** — Re-read the relevant sections of `NerdyProjectBrief.md`:
   - Does the implementation satisfy the brief's requirements for this area?
   - Are there evaluation criteria (from the "Evaluation Criteria" section) that this phase should address? Are they met?
   - Are there bonus point opportunities related to this phase that were missed?

4. **Look for gaps** — Specifically check:
   - Missing edge case handling (empty inputs, malformed LLM responses, API failures)
   - Type mismatches between modules (does the output of one agent match what the next agent expects?)
   - Test coverage gaps (any pure logic without tests? any branches untested?)
   - Configuration that is hardcoded when it should use values from `src/config/`
   - Prompt template issues (missing context the agent needs, unnecessary context inflating token cost)

5. **Report findings** — Present a short summary:
   - **Implemented as planned:** list of items that match the spec
   - **Gaps found:** list of missing or incomplete items with specific file/line references
   - **Bugs or issues:** any problems discovered during review
   - **Suggestions:** improvements that aren't in the plan but would strengthen the phase

6. **Fix gaps** — After reporting, fix any gaps or bugs found (following TDD — write failing test first, then fix). Do NOT move to the next phase until gaps are resolved.

7. **Update docs** — After fixing gaps:
   - Update `docs/decision-log.md` if any new decisions were made during the fix
   - Update `STUDY_GUIDE.md` with the phase completion summary
   - Update `CLAUDE.md` status section to reflect the new current phase

## Important

- Do not skip this review. It catches integration issues early that compound later.
- Be honest about gaps — documenting known limitations is better than hiding them.
- If a gap is intentional (e.g., on the cut list), note it as a conscious skip, not a miss.
