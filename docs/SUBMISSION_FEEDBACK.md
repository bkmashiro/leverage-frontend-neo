# Submission feedback and recovery

Formal submission feedback is shared by ordinary, course and contest problem pages and the submission detail page. It reuses the existing status/wait API; submitting does not navigate away from the editor.

## Recovery contract

- Before POST, the browser persists a UUID v4 request ID and SHA-256 payload fingerprint in sessionStorage scoped to the current user and route. The receipt contains no source or stdin. The server atomically binds the ID to the exact payload and stored submission. An accepted request replay returns the same submission; a different payload with the same ID returns 409.
- An uncertain response is recovered with the authenticated `GET /submissions/by-request/:requestId`, never an automatic POST. Refresh and the explicit recovery action use the same read. Manual retries of unchanged, still-unconfirmed payloads reuse the ID. Browser storage failure prevents sending a request without a recoverable ID.
- After an acknowledged POST, the problem URL stores `?submission=<id>`. Refresh reads that submission before waiting. The record must match the current user, problem and course/contest context. A result URL never causes another POST.
- The detail route reads the current full record. A completed record, including CE, SE, RE, OLE and SC, does not open a long-poll request.
- A pending record starts with `after=''`, then carries the server version cursor. When a terminal notification arrives, the client retries the detail read until it succeeds. If that read races a rejudge and returns pending, observation continues.
- Network errors, request timeouts, HTTP 408/429 and server errors retry with a 500 ms to 8 s exponential delay. Reads and the initial submission request have 30 s transport deadlines. These are engineering settings, not execution limits.
- Offline cancels the current request. Online performs a fresh read. Route changes, unmount and account changes dispose requests and timers. Other 4xx responses stop automatic retries and expose a manual retry action.
- After 30 s without progress, a hint explains that the result is still pending. It never converts missing feedback into a failed verdict. There is no automatic re-submission. If the POST outcome is uncertain, the recovery receipt remains until the original record is found or the server definitively rejects the request.

## Display contract

Run and submit controls share a compact toolbar. Input, trial output and formal feedback use tabs; observers remain mounted when a tab is hidden. Starting an action selects its result tab, while later test-case updates do not steal the selected tab. Refresh restores known formal feedback. The editor and submit button remain in place. One test-case table progresses to the terminal result instead of inserting duplicate progress, success and detail cards. Only real compilation errors open a compiler diagnostic block. Numeric zero and missing memory remain distinct. Output is escaped text.

Waiting, compilation and judging labels use server states 9, 11 and 10. A final notification is shown as “reading the final result” until the authoritative detail read succeeds. Public sample output comparison retains the original per-line/whole-output `trimEnd` normalization. First-difference context is bounded around the actual mismatch; whitespace markers are opt-in. Custom input and SPJ never receive sample answer judgements.

The result surface uses only 140 ms color/border transitions, disabled for `prefers-reduced-motion`. No route animation, height animation, forced progress interpolation or automatic scrolling is introduced. Fullscreen feedback is locally bounded so the submit controls remain reachable.

## Trial-run recovery

The run panel stores only the run ID in sessionStorage, scoped to the signed-in user and route. Refresh or remount reads the record with server-side ownership checks. Completed results keep that ID for subsequent refreshes but open no wait request. An expired/inaccessible record (404) clears it, and 401/403 stops observation. Logout clears the currently owned key.

GET, POST and cancellation requests have 30 s transport deadlines and are abortable. Transient GET/wait failures retry; offline pauses reads and online resumes. A failed cancellation re-reads the same run to establish its actual state. Neither recovery nor a failed POST automatically re-sends code. While restoring, the UI does not fabricate a running status. New runs retain the old output labelled as the previous result; long output scrolls locally without a position or height animation.

## State ownership

Browser observers are disposable. A refresh does not need a durable browser session on the server. The database submission and bounded, attempt-scoped progress snapshots belong to evaluation/history, independently of whether a browser is currently observing. Stopping a browser waiter does not cancel or delete the submission.

## Verification

- `e2e/submission-feedback.spec.ts`: in-place submission, refresh recovery across all three contexts, initial fetch recovery and owner/context rejection.
- `e2e/submission-recovery.spec.ts`: terminal errors, network/permission recovery, long-wait hint, request cleanup, button geometry and reduced-motion.
- `e2e/submission-long-poll.spec.ts`: partial results and terminal-detail retry.
- `e2e/ux-contracts.spec.ts`: legacy/current result normalization, zero memory and a single test-case table.

These frontend browser tests mock API responses. The backend suite `test/e2e/workbench-browser.e2e.spec.ts` is an explicit real-browser opt-in via `FRONTEND_SNAPSHOT_PATH`: it builds the production UI, uses disposable MariaDB/Redis, a separate worker and a real Docker judge, and drops an accepted POST response to exercise recovery. The task artifact records which suites actually ran and their outcomes.
