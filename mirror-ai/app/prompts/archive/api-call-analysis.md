# api-skill — API Call Analysis

Runs as part of the audit, on the same module and the same evidence. It adds one
section to the report, after the Business Logic Difference Matrix.

## Objective

Count what each platform asks the network for, and decide which of those calls
are unnecessary or unbounded.

Two questions drive the section:

1. **How many API calls does each platform make for this module?** Distinct
   endpoints, and how many times each one fires in one pass through the flow.
2. **Which calls should not happen, or cannot be predicted?** A call is a
   finding when it is redundant, duplicated, uncapped, or fires a number of
   times that depends on something other than the user's intent.

## What to trace

For every network call the module reaches — directly, or through a repository,
use case, service, interceptor, or shared client:

- The endpoint: method and path as the code builds it, not as you imagine it.
- The call site, as `path/File.kt:124-129`, and the function that owns it.
- The trigger: what causes it to fire. A screen opening, a tap, a state change,
  a recomposition or SwiftUI `body` evaluation, an `onAppear`, a collector, a
  timer, a retry, an app foreground, a token refresh.
- How many times it fires in one ordinary pass through the flow.
- The largest number of times it can fire, and what makes that happen.
- What happens when it fails, and whether the failure path calls it again.

Follow the call into shared code. A call made once in a view model but wrapped
in a repository that itself retries is two different numbers; report the number
of requests that actually reach the network.

## What counts as unnecessary

Name a call unnecessary only with evidence in the code, not a suspicion:

- **Duplicate** — the same endpoint with the same arguments is fetched twice in
  one flow, by two call sites or by one that runs twice.
- **Redundant** — the response is already held in a store, cache or navigation
  argument the module can read instead.
- **Discarded** — the result is fetched and never used, or is overwritten by a
  later call before anything reads it.
- **Eager** — the call fires before anything needs it, on a path where the user
  often never reaches the screen that uses it.

## What counts as unpredictable

These are the paths where the call count is not a number but a function of
something outside the user's control. Each one is a finding:

- **Uncapped retry** — a failure path that calls again with no maximum, no
  backoff, or a condition that can stay true.
- **Re-entrant render** — a call started from a Compose composition or a
  SwiftUI `body`/`onAppear` that re-runs whenever state changes, so a response
  that updates state triggers the next call.
- **No in-flight guard** — a tap or a pull-to-refresh that starts a second
  request while the first is running, so N taps make N requests.
- **Unbounded fan-out** — a call per item over a collection whose size comes
  from the server or the user's account list: N accounts, N lines, N pages.
- **Unbounded paging** — a page loop with no last-page condition, or one that
  depends on a field the server may not send.
- **Undebounced input** — a search or validation call per keystroke.
- **Timer or poll** — a repeating call whose stop condition is missing, depends
  on a response that may never arrive, or survives the screen being left.
- **Racing responses** — two in-flight requests whose order decides the final
  state, so the same actions can end in different states.

For each, say what the count actually depends on — "once per keystroke",
"once per linked account", "forever, every 5s, until the screen is dismissed" —
rather than writing "many".

## Section to publish

### 3. API Call Analysis

Open with one table, exactly these columns:

| Platform | Distinct endpoints | Calls in a typical pass | Worst case | Unnecessary | Unpredictable |
|---|---|---|---|---|---|

One row for Android, one for iOS. Counts are integers where the code allows a
count, and `unbounded` where it does not. The last two columns are how many of
the rows below are marked against that platform.

Then one row per endpoint, ordered worst first, with exactly these columns:

| ID | API | Android Calls | iOS Calls | Trigger | Worst Case | Verdict | Risk |
|---|---|---|---|---|---|---|---|

- **ID** — `API-01`, `API-02`, in order.
- **API** — method and path, e.g. `GET /v1/accounts/{id}/offers`. If the path
  is assembled at runtime, write the shape and say so.
- **Android Calls** / **iOS Calls** — how many times that platform calls it in
  one ordinary pass, then the call site, e.g. `1× on screen open
  (AisleViewModel.kt:44)`. Write `Not called` where the platform never does,
  and say so plainly rather than leaving the cell empty.
- **Trigger** — what fires it, in a few words.
- **Worst Case** — the largest number of requests that can reach the network,
  and what drives it. `3 (one retry per failure)`, `unbounded — one per
  keystroke`, `N — one per linked account`.
- **Verdict** — exactly one of these, spelled exactly like this:
  `Necessary`, `Duplicate`, `Redundant`, `Discarded`, `Eager`,
  `Uncapped Retry`, `Re-entrant Render`, `No In-flight Guard`,
  `Unbounded Fan-out`, `Unbounded Paging`, `Undebounced Input`,
  `Timer Or Poll`, `Racing Responses`.
- **Risk** — what it costs: the user-visible effect, the load, or the wrong
  state it can leave behind. One sentence. For a `Necessary` row, write what
  keeps it bounded.

Keep each cell to one line of prose. No line breaks, no bullets, no nested
tables. If the module makes no network call on either platform, write one
sentence saying so and publish no tables.

Everything the main spec says about evidence applies here: cite real paths and
lines, never invent an endpoint or a contract, and where static reading cannot
settle how often something fires, say that instead of picking a number.
