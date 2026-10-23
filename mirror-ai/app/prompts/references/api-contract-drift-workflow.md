# 10 · API contract drift (workspace rule)

Cross-platform BFF contract checks for **any** of the 6 app repos. Applies workspace-wide via [`.cursor/rules/api-contract-drift.mdc`](../.cursor/rules/api-contract-drift.mdc).

---

## Goals

| Phase | What | Output |
|-------|------|--------|
| **1 (now)** | Agent + rule: compare Android ↔ iOS on request/wiring changes | **Cursor Canvas** (primary) + slim Markdown summary + worklog |
| **2 (later)** | Scripted parsers | Regenerate canvas data from `tools/lib/*.py` (local tooling branch) |

---

## Triggers

Single Cursor rule: [`.cursor/rules/api-contract-drift.mdc`](../.cursor/rules/api-contract-drift.mdc) § Mode selection — **incremental by default**; **full market only on command**. Claude: [`.claude/rules/api-contract-drift.md`](../.claude/rules/api-contract-drift.md) (same modes).

### Incremental (default)

You changed a request model or Service wiring → check **that BFF path** on both platforms before merge. Do **not** generate canvas or full `docs/reports/*.md`.

### Full market (explicit command only)

User must ask — e.g. **`api report superapp`**, **`api report panama`**, **`api report myliberty`**, or **`full api contract drift`** + market. Then inventory all wired BFF paths and produce:

1. **Cursor Canvas** — interactive report (primary deliverable; see [Canvas layout](#canvas-layout-primary-deliverable) below).
2. **Markdown report** — mirrors canvas data and column semantics, including full API inventory tables (see [Markdown summary layout](#markdown-summary-layout-secondary)).

**Reference implementation:** `canvases/superapp-jamaica-api-contract-drift.canvas.tsx` in this workspace’s Cursor project folder (copy structure for the next market).

---

## How to run

Copy-paste prompts for Cursor or Claude. Confirm **sprint branch** with your developer before either mode (rule 8).

### Scenario A — Incremental (PR / single API change)

**When:** You changed a request body, Service method, path constant, or per-call header on one platform.

**Prompt examples:**

```
Check API contract drift for the path I changed in this PR — compare Android vs iOS at sprint SHA.
```

```
Incremental drift check: POST topup — branch Jamaica/feature/development
```

```
Does otp-update match on both platforms? Sprint branch is <name> — incremental only, no full report.
```

**What the agent does:**

1. Confirms market + sprint branch + both SHAs.
2. Finds the BFF relative path for your change.
3. Reads Android + iOS wiring at pinned SHA (outcome-based discovery for **that path only**).
4. Reports: Contract (Same / Drift / Android only / iOS only), drift tags, body/header diff.
5. Adds a short note to **PR description** or **`docs/worklog/`** — no canvas, no `docs/reports/*.md`.

**You provide (if not obvious from context):** market, sprint branch name, path or file you changed.

---

### Scenario B — Full market audit

**When:** Release prep, new market onboarding, or periodic cross-platform inventory.

**Prompt examples:**

```
api report superapp
```

```
api report panama
```

```
full api contract drift — MyLiberty, sprint branch feature/v2.27/sprint_2.27
```

**What the agent does:**

1. Confirms market + sprint branch + pins Android and iOS SHAs.
2. Full outcome-based discovery (all wired BFF paths, baseline headers, stale constants).
3. Writes **Canvas** → `canvases/<market-slug>-api-contract-drift.canvas.tsx`.
4. Writes **Markdown** → `docs/reports/<market-slug>-api-contract-drift.md`.
5. Writes **`docs/worklog/YYYY-MM-DD-<slug>.md`**.
6. **Surfaces deliverable** — Cursor: open canvas (§ Deliverable by tool); Claude: `docs/reports/*.md`.

**You provide:** market name (or say which repo you're in). Sprint branch if Panama/MyLiberty (names change each release).

| Market | Example command | Report slug |
|--------|-----------------|-------------|
| Superapp Jamaica | `api report superapp` | `superapp-jamaica-api-contract-drift` |
| Panama | `api report panama` | `panama-api-contract-drift` |
| MyLiberty | `api report myliberty` | `myliberty-api-contract-drift` |

**Outputs are local/gitignored** (canvas + `docs/reports/`) except the worklog entry.

### Deliverable by tool (full market)

Full reports produce **both** artifacts locally; **which one you open for the user depends on the IDE**:

| Tool | Primary deliverable | After generation |
|------|---------------------|------------------|
| **Cursor** | **Canvas** (`canvases/<slug>-api-contract-drift.canvas.tsx`) | **Mandatory:** open canvas beside chat via **Open Resource** / `open_resource` (absolute path). Also mention `docs/reports/<slug>.md` as secondary. |
| **Claude Code / terminal** | **Markdown** (`docs/reports/<slug>-api-contract-drift.md`) | **Mandatory:** point user to the `.md` path (full inventory, 8 columns). Optionally note canvas filename for teammates on Cursor — **do not** call `open_resource` (no Canvas UI). |

Same discovery data feeds both files in one session when both are generated.

**Cursor only — open canvas (mandatory):** After writing the `.canvas.tsx`, confirm **Canvas TypeScript check: no errors**, then `open_resource` on `{cursor-project}/canvases/<slug>-api-contract-drift.canvas.tsx`. Include a markdown link to that path in the reply (`~/.cursor/skills-cursor/canvas/SKILL.md` § Introducing the canvas).

**Claude only — markdown (mandatory):** End the turn with the report path and a short KPI summary. Canvas generation is optional unless the user also uses Cursor.

**Incremental** PR checks: neither canvas nor full `docs/reports/*.md` — PR summary or worklog only.

---

## Market context (agent resolves — do not hard-code)

Before any audit, determine **which market** you are in. Never assume Jamaica/Superapp unless the task or repo says so.

| Signal | Use it for |
|--------|------------|
| Repo folder open (`lla_panama_*`, `lla_myliberty_*`, `lla-superapp-*`) | Market + which Android/iOS pair |
| `git remote get-url origin` in an app repo | Confirm market if ambiguous |
| User / ticket names market or tenant | Authoritative when stated |
| Sprint branch | Read current name from [`01-system-overview.md`](01-system-overview.md) §2 or ask — **never assume from memory** |

**Read for this market:**

| Need | Where |
|------|--------|
| Domain family, BFF path pattern | [`02-cross-platform-contracts.md`](02-cross-platform-contracts.md) §1 |
| Per-flavor base URLs | [`08-environment-matrix.md`](08-environment-matrix.md) — market section |
| Sprint branch, repo names | [`01-system-overview.md`](01-system-overview.md) §1–2 |
| Baseline auth headers | [`02-cross-platform-contracts.md`](02-cross-platform-contracts.md) §2–3 |

**Discover from code at pinned SHA** (market-specific paths differ):

| Platform | Typical base-URL sources |
|----------|-------------------------|
| Android | `build.gradle.kts` `BASE_URL`, `Tenants.kt`, flavor `buildConfigField`, `NetworkModule` |
| iOS | `NetworkConstants.swift`, `*xcconfig` `API_BASE_URL`, `Environments.swift` (Panama) |

**BFF prefix** is not identical across markets (e.g. `/api/lla_app_bff/v1/` vs `/api/metac-app-bff/v1/`). Read the path constants in **that** market's repos — do not copy from another market or from an old report.

---

## Discovery (mandatory before canvas or markdown)

Full-market audits require **outcome-based discovery** at pinned SHAs.

**Do not** assume `@Header`, `*Request.kt`, `*Request.swift`, `HTTPHeaders.swift`, or Jamaica-specific file names. Each repo wires HTTP differently.

### Outcomes required

| Artifact | Outcome |
|----------|---------|
| Baseline header table | Every header added globally (interceptors, middleware, default client config) on each platform |
| API inventory | Every BFF path wired in a Service/client at pinned SHA |
| Body columns | Short field list from whatever builds the payload for each path |
| Extra header columns | Per-call headers beyond baseline — however this repo sets them |
| Wiring notes | `integrated` / `stale` / `absent`; platform-exclusive paths |

### How to discover (repo-agnostic)

For **each platform** at pinned SHA:

1. **Find the HTTP entry layer** — BFF prefix, path constants, Retrofit interfaces, API clients, generated clients, `URLRequest` builders, etc.
2. **Enumerate wired paths** — constants + methods that hit the BFF (not dead constants with zero callers).
3. **For each path, trace one hop backward** to body (encoder, DTO, map, …) and per-call extras (annotations, builders, per-request config).
4. **Record evidence** — `file:line` or symbol. If unresolved → Notes: `unverified — nearest: <file>`; do not leave body/extra columns silently empty.

After discovery, record **this market's** patterns in `META` or worklog (Superapp Jamaica `HeaderInterceptor.kt` / `HTTPHeaders.swift` / `*Request` are **examples only**).

### Discovery gates (do not ship if failed)

| Gate | Fail if |
|------|---------|
| No template paste | `APIS` / `BASELINE_HEADERS` copied from another market without re-reading this repo |
| Inventory sourced | Paths with no file evidence on at least one platform |
| Baseline identified | Global header layer not named for each platform |
| Columns explained | Empty body/extra columns without `unverified` in Notes |

---

## Outputs (local only — gitignored, not committed)

| Artifact | Path | Role |
|----------|------|------|
| **Canvas** | `{cursor-project}/canvases/<market-slug>-api-contract-drift.canvas.tsx` | Primary for **Cursor** — full inventory, chips, charts, collapsible modules |
| **Markdown report** | `docs/reports/<market-slug>-api-contract-drift.md` | Primary for **Claude / terminal** — same data as canvas; create `docs/reports/` if missing (gitignored) |
| **Markdown template** | [`docs/templates/api-contract-drift-summary.template.md`](templates/api-contract-drift-summary.template.md) | Committed copy-paste skeleton for `.md` generation |
| **Canvas layout template** | [`docs/templates/api-contract-drift.canvas.template.tsx`](templates/api-contract-drift.canvas.template.tsx) | Committed structure + helpers — copy to `canvases/`; **do not edit during report runs** |

Slug examples: `panama-api-contract-drift`, `myliberty-api-contract-drift`, `superapp-jamaica-api-contract-drift` (market + tenant when relevant).

**Canvas must be written under** the workspace Cursor project `canvases/` directory (IDE only detects `.canvas.tsx` files there). Read `~/.cursor/skills-cursor/canvas/SKILL.md` before authoring.

**For the next full-market report:** copy [`api-contract-drift.canvas.template.tsx`](templates/api-contract-drift.canvas.template.tsx) to `canvases/<slug>-api-contract-drift.canvas.tsx`, then replace embedded `APIS`, `BASELINE_HEADERS`, and `META` with discovery data — keep layout, helpers, and all table column sets unchanged.

### Canvas file naming (standard)

Use **one basename** for canvas + markdown in the same audit session:

| Artifact | Pattern | Superapp Jamaica example |
|----------|---------|---------------------------|
| Canvas | `{cursor-project}/canvases/<slug>.canvas.tsx` | `superapp-jamaica-api-contract-drift.canvas.tsx` |
| Markdown | `docs/reports/<slug>.md` | `superapp-jamaica-api-contract-drift.md` |

`<slug>` = market slug from the table in § How to run (e.g. `panama-api-contract-drift`, `myliberty-api-contract-drift`).

**Do not** use alternate canvas names (e.g. `*-api-drift.canvas.tsx` without `contract`) — they break cross-links in the markdown blockquote and confuse teammates.

**Legacy:** `superapp-jamaica-api-drift.canvas.tsx` is retired; rename or delete if still present locally.

### Canvas compile checklist (before handing off)

Generated `.canvas.tsx` files are **not** in git. After writing or regenerating a canvas:

1. Open the file in Cursor Canvas — must compile with no error banner.
2. Pass **§ JSX inline styles (mandatory)** below — agents fix brace errors themselves; do not ask the user to edit line 67.
3. Prefer `display: "inline-flex"` for chips (matches reference helpers).
4. Import only from `cursor/canvas`; default export one component; no `fetch()`.
5. Markdown report blockquote must name the **same** canvas filename as § Canvas file naming.

### JSX inline styles (mandatory)

**Rule:** In JSX, a `style` prop is always either `style={{ ... }}` (object inside an expression) or `style={mergeStyle(a, b)}` from `cursor/canvas`. **Never** `style={ display: "..." }` — that is invalid TSX and produces `Expected "}" but found ":"`.

| Wrong | Right |
|-------|--------|
| `style={ display: "inline-block", padding: 4 }` | `style={{ display: "inline-flex", padding: 4 }}` |
| `style={ fontSize: 11 }` | `style={{ fontSize: 11 }}` |

**When authoring API drift canvases:**

1. **Copy helpers verbatim** from [`api-contract-drift.canvas.template.tsx`](templates/api-contract-drift.canvas.template.tsx) (`tintHex`, `categoryTint`, `TintedLabelChip`, `PlainChip`, `DriftTagChip`, `DriftTags`, `CodeInline`, `ModuleCell`, …). Do not retype `style` blocks from memory.
2. **Before finishing**, scan the file: every `style=` must be followed by `{{` or `mergeStyle` — fix any single-brace mistake in the same turn.
3. **If Canvas reports a compile error** on a line with `display:` / `padding:` / `background:` inside `style={`:
   - Wrap the CSS properties in an object: `style={{ ...allProps }}`.
   - Re-run until **Canvas TypeScript check: no errors** (see `~/.cursor/skills-cursor/canvas/SKILL.md` § Troubleshooting).
4. Do **not** hand off to the user with a broken canvas — fix braces in the agent session.

### Canvas and report generation (do not break structure)

**Problem to avoid:** Regenerating a whole `.canvas.tsx` from scratch to fix one TSX error, or “simplifying” tables — that drops columns, breaks module layout, and forces teammates to fix by hand.

| Rule | Requirement |
|------|----------------|
| **Layout source** | [`docs/templates/api-contract-drift.canvas.template.tsx`](templates/api-contract-drift.canvas.template.tsx) — copy to `canvases/<slug>-api-contract-drift.canvas.tsx` |
| **Do not edit template on report runs** | Never modify the committed `.canvas.template.tsx` while generating a market report — only fix the **local** canvas under `canvases/` |
| **Existing local canvas** | If the file exists and layout matches template: change **data only** (`META`, `KPIS`, `BASELINE_HEADERS`, `APIS`, `STALE`, module summary derived from `APIS`) |
| **Compile error** | Surgical fix (`style={{ }}`) or replace **helper functions** from template — **not** a full-file rewrite |
| **Markdown** | Generate from the **same** `APIS` / `BASELINE_HEADERS` as canvas — never a shorter column set |

**Fixed column sets (never omit a column to “fit”):**

| Table | Headers |
|-------|---------|
| Per-path inventory (each module) | Path · Contract · Drift · **Android extra** · **iOS extra** · Android body · iOS body · Notes (**8**) |
| Module summary | Module · APIs · Same · Drift · HDR · Exclusive · Total diff (**7**) |
| Baseline | Header · Android · iOS · Status · Tag (**5**) |
| High-risk | Path · Contract · What to check · Drift (**4**) |

Validate: `headers.length === row.length` for **every** `Table` row and every markdown table row. Dropping **Android extra** / **iOS extra** is a **failed audit**.

**Forbidden shortcuts:** pie charts for contract status; hardcoded module summary rows (use `modStats`); removing `Swatch` / count bubbles from module table; replacing tinted chips with plain text in canvas inventory.

---

## Canvas layout (primary deliverable)

Section order (top → bottom). **Values** are market-specific; **structure** is fixed.

### 1 · Title block

- `H1` — `{Market} — API Contract Drift`
- Meta line: sprint branch, Android/iOS short SHAs, generated date
- Chips: BFF prefix, method, host match, tenant id

### 2 · How to read this report (collapsible legend)

Place **above** the KPI row. `CollapsibleSection` (`defaultOpen={false}`); trailing hint `Contract · Drift tags`.

- Short intro: **Contract**, **Drift**, and **Android extra / iOS extra** columns
- **Contract values** table — tinted status chips (same palette as inventory)
- **Drift type tags** table — tinted drift chips (same palette as inventory)
- Note on row dot colors (severity hint)

### 3 · KPI row (`Grid` 6 columns)

| Stat | Label |
|------|-------|
| … | APIs audited |
| … | Contract match (`tone: success`) |
| … | Drift (`tone: warning`) |
| … | Platform exclusive (`tone: info`) |
| … | High risk (`tone: danger`) |
| … | Stale constants |

### 4 · Module drift overview

- Title row: `H3` **Header & contract diff by module** + two `Stat`s (Endpoint HDR drifts, Total module diffs)
- `Grid` **1fr 1.2fr**: horizontal `BarChart` (HDR / contract drift / route exclusive per module) | module summary `Table`
- Module table columns: **Module · APIs · Same · Drift · HDR · Exclusive · Total diff**
- **Module** cell — `Row` with `Swatch` (module `CATEGORY_COLOR`) + status dot (orange when `drift > 0`, cyan otherwise) + semibold name
- **Drift / HDR** — em dash `—` when zero; **HDR** and **Total diff** non-zero values in plain `PlainChip` bubbles
- **Total diff** — count of APIs where `contract !== same` **or** path has `HDR` drift tag (includes HDR-only on otherwise-matching paths); derive from `modStats`, never hardcode rows
- No separate `H2` “Module drift overview” — start directly with the `H3` above

### 5 · Charts row (`Grid` 2 columns)

- **Contract status** — track-board-style chips per bucket (`label · count · %`) + gray `{n} paths` chip; use a real middle dot (`·`) in template literals — never the literal string `\u00b7`; **no pie chart**
- **Route coverage** — `UsageBar` split (same / drift / android-only / ios-only)

### 6 · High-risk findings

- Title row + count chip + one-line subtitle
- Single striped `Table`: **Path · Contract · What to check · Drift** (include baseline `uid`/`UID` as last row)
- All rows `rowTone="danger"` — no stacked callout cards

### 7 · API inventory by module

First row: **`CollapsibleSection` “Baseline header”** (`defaultOpen`, `leading={<Swatch color="gray" />}`) — interceptor table before module paths.

- Summary chips: Same / Drift / Android only / iOS only counts (plain `Chip`, not tinted)
- Full `Table`: **Header · Android · iOS · Status · Tag**
  - **Status** column — `TintedLabelChip` (Same=green, Drift=orange, A only=blue, iOS only=purple)
  - **Tag** column — `DriftTags` when tag ≠ `—`
- Source footnote (interceptor file paths @ sprint SHA)
- Trailing chips: Diff / Drift / platform-only counts

Then fixed module order: **Auth → Account → Storefront → Payments → Loyalty → Comms**

`CollapsibleSection` per module; trailing chips: HDR / Drift / Exclusive counts.

Per-path table columns (no Risk column, no filter/search UI):

| Column | Content |
|--------|---------|
| Path | BFF relative path |
| **Contract** | Cross-platform alignment — `TintedLabelChip`: Same / Drift / Android only / iOS only (see [Contract column](#contract-column)) |
| **Drift** | `DriftTags` — `BODY` · `HDR` · `ROUTE` · `TYPE` · `CASE` · `HOST`; one tinted pill per tag |
| **Android extra** | Per-call headers beyond interceptor baseline — italic `baseline` when none; e.g. `+ lob`, `(uid header lowercase)` |
| **iOS extra** | Same for iOS — e.g. `+ lob`, `(UID header + body uid)`; `—` when path is Android-only |
| Android body | Short field summary |
| iOS body | Short field summary |
| Notes | Human note |

Row tone (dot marker) may still reflect severity internally; do not show a separate Risk column.

### 8 · Stale constants

`CollapsibleSection` + table: Path · Android wiring · iOS wiring · Notes

### 9 · Environment base URLs

`CollapsibleSection` (default closed): Env · Android host · iOS host · Match

Use `Divider` between major blocks below the title block.

### Visual styling

Reuse the shared tint helpers from `superapp-jamaica-api-contract-drift.canvas.tsx` on every full-market canvas.

**Helpers (copy into each canvas):**

| Helper | Purpose |
|--------|---------|
| `tintHex(hue, alpha)` | Append alpha to `theme.category[color]` hex |
| `categoryTint(theme, color)` | Returns `cellBg` (12%) + `cellBorder` (22%) for a category color |
| `TintedLabelChip` | Contract + baseline **Status** pills — tinted cell wrapper + label |
| `DriftTagChip` / `DriftTags` | Drift column + baseline **Tag** column — one tinted pill per tag type |

**Color map (same type → same tint everywhere):**

| Kind | Value | Category color |
|------|-------|----------------|
| Contract / Status | Same | green |
| Contract / Status | Drift | orange |
| Contract / Status | Android only / A only | blue |
| Contract / Status | iOS only | purple |
| Drift tag | BODY | orange |
| Drift tag | HDR | cyan |
| Drift tag | ROUTE | blue |
| Drift tag | TYPE | purple |
| Drift tag | CASE | red |
| Drift tag | HOST | pink |

**Rules:**

- Contract, Status, and Drift inventory cells use **theme-aware tinted fills** via `useHostTheme().category[color]` — readable in **light and dark**; no hardcoded hex or light-only gray assumptions
- Chip text: `theme.text.primary` / `secondary` — never assume dark text on a light pill
- Multi-tag Drift rows: separate tinted pill per tag (e.g. `ROUTE` blue + `BODY` orange)
- Title/meta chips, module trailing counts, and contract-status summary row keep plain `Chip` (not tinted)
- Do **not** use pie charts for contract status — use count chips instead
- Do **not** prefix extra-header labels with `§3` — use `baseline`, `+ lob`, etc.

### Android extra / iOS extra columns

Headers sent **on top of** the interceptor baseline for that specific path (not the global baseline table).

| Display | Meaning |
|---------|---------|
| *baseline* (italic) | Interceptor headers only — no per-call extras |
| `+ lob` | Extra `lob` header on this call |
| `+ countryCode` | Extra `countryCode` header (e.g. `JM`) |
| `+ lob (optional)` | Lob header present on some code paths only |
| `(uid header lowercase)` / `(UID header + body uid)` | Casing / body notes for uid |
| `—` | Path not wired on that platform |

Derive from per-path header wiring at pinned SHA (repo-specific — annotations, builders, client config, etc.); override with `androidExtra` / `iosExtra` on `ApiRow` when needed.

---

## Contract column

**Contract** = cross-platform alignment for that BFF path at the pinned SHA (not HTTP method or response type).

| Value | Meaning |
|-------|---------|
| **Same** | Wired on both; request contract matches |
| **Drift** | Wired on both; body, headers, types, or orchestration differ |
| **Android only** | Wired on Android, absent on iOS |
| **iOS only** | Wired on iOS, absent on Android |

The **Drift** column lists *what kind* of mismatch (`BODY`, `HDR`, …) when applicable. Render with `DriftTags` so each tag type keeps a consistent tinted color.

The **Android extra / iOS extra** columns document per-path header deltas vs the baseline interceptor set (see [Android extra / iOS extra columns](#android-extra--ios-extra-columns)).

---

## Markdown summary layout (secondary)

**Path:** `docs/reports/<market-slug>-api-contract-drift.md` (gitignored — generate locally, do not commit).

**Template:** copy [`docs/templates/api-contract-drift-summary.template.md`](templates/api-contract-drift-summary.template.md), replace placeholders, write to `docs/reports/`.

Generate the `.md` **in the same session** as the canvas, from the same pinned SHAs and `APIS` / `BASELINE_HEADERS` data.

### What belongs in Markdown vs canvas

| Content | Canvas | Markdown report |
|---------|:------:|:----------------:|
| Full API inventory (all paths) | yes | **yes** — per-module tables, same columns |
| Baseline header full table | yes | yes |
| Android extra / iOS extra per path | yes | yes |
| Tinted Contract / Drift chips | yes | plain text / backtick tags (same labels) |
| High-risk table | yes | yes — same columns |
| Module summary table | yes | yes |
| Contract status counts | yes (chips) | yes (table with %) |
| Stale constants | yes | yes |
| Environment URLs | yes | yes |
| Bar charts / UsageBar / collapsible UI | yes | **no** — open canvas for visuals |

### Section order (match canvas)

1. **Canvas link** — blockquote first line pointing to `{market}-api-contract-drift.canvas.tsx`
2. **Title + meta** — market, sprint, SHAs, BFF prefix, host match, tenant
3. **KPIs** — same six stats as canvas KPI row
4. **Contract status** — table: Status · Count · % (replaces pie chart data)
5. **How to read** — Contract, Drift, Android extra / iOS extra definitions (compact table)
6. **Module summary** — same columns as canvas module table
7. **High-risk findings** — table: **Path · Contract · What to check · Drift**; include `uid`/`UID` baseline row last
8. **Baseline headers** — diff counts + **full interceptor table** (Header · Android · iOS · Status · Tag)
9. **API inventory by module** — Auth → Comms; columns: Path · Contract · Drift · Android extra · iOS extra · Android body · iOS body · Notes
10. **Stale constants** — compact table
11. **Environment base URLs** — Dev / Staging / Pre-prod / Prod
12. **Key patterns** — 3–5 bullets (recurring drifts, platform-exclusive clusters)
13. **Footer** — link to this doc + canvas filename + short SHAs

### Text conventions (mirror canvas labels)

Use the **same strings** as the canvas so readers can cross-reference:

| Canvas | Markdown |
|--------|----------|
| `TintedLabelChip` Same / Drift / Android only / iOS only | **Same** / **Drift** / **Android only** / **iOS only** in table cells |
| `DriftTags` BODY, HDR, … | `` `BODY` ``, `` `HDR` `` — comma-separated in one cell |
| *baseline* (italic) in extra columns | *baseline* in markdown extra columns (same as canvas) |
| `+ lob`, `+ countryCode` | same backtick form in Key patterns or high-risk notes |
| `—` (platform not wired) | `—` |

Do **not** use `§3` or section-sign prefixes in the Markdown summary.

### Column validation

For every `Table` (canvas) or markdown table: **`headers.length === row.length`** for each row. Dropping **Android extra** or **iOS extra** is a failed audit.

### Agent checklist (full-market audit)

1. Pass discovery gates above.
2. **Canvas:** if `canvases/<slug>-api-contract-drift.canvas.tsx` missing → copy [`api-contract-drift.canvas.template.tsx`](templates/api-contract-drift.canvas.template.tsx) there; if present → update data blocks only (§ Canvas and report generation). Do **not** edit the committed template file.
3. Pass § Canvas compile checklist + § JSX inline styles; all fixed column sets present.
4. Copy [`api-contract-drift-summary.template.md`](templates/api-contract-drift-summary.template.md) → `docs/reports/<slug>-api-contract-drift.md`.
5. Fill markdown from **same** `APIS` / `BASELINE_HEADERS` as canvas — all **8** inventory columns per module.
6. Validate `headers.length === row.length` on every table (canvas + md).
7. Blockquote must name the exact canvas filename.
8. **Cursor:** `open_resource` on canvas path. **Claude:** highlight markdown report path — § Deliverable by tool.
9. Add worklog row per rule 2.

---

## Legacy full Markdown layout (deprecated for full audits)

Do **not** generate wide multi-column Markdown tables for full-market audits. Use the canvas instead. The former layout is retained below only for incremental PR notes or if canvas tooling is unavailable.

### 1 · Title block

```markdown
# {Market name} — API contract drift report

- **Generated:** YYYY-MM-DD
- **Market:** {e.g. Panama / MyLiberty (PR) / Superapp Caribbean — tenant if applicable}
- **Repos:** `{android-repo}` @ `{android-sha}` · `{ios-repo}` @ `{ios-sha}`
- **Sprint branch:** `{confirmed branch name}`
- **BFF:** `{METHOD} {host}{bff-prefix}{relative-path}`
```

### 2 · Base URLs (HTML: hero meta + `HOST` drift rows)

**Agent:** Read base URLs from this market's config files and [`08-environment-matrix.md`](08-environment-matrix.md). Compare Android vs iOS per env; flag any host mismatch even when path constants match.

Full request shape (template — substitute discovered values):

```text
{ANDROID_BASE_URL}{bff-prefix}{relative-path}
{IOS_BASE_URL}{bff-prefix}{relative-path}
```

Default method for BFF catalog rows: **POST JSON**, unless code or docs show otherwise. Rows tagged **`HOST`** use a different base — list them in the alternate-hosts table.

```markdown
## Base URLs

- **Audited env:** {Dev | Staging | Pre-prod | Prod}
- **Android base:** `{from repo at SHA}` — evidence: `{file:line}`
- **iOS base:** `{from repo at SHA}` — evidence: `{file:line}`
- **BFF prefix:** `{discovered prefix, e.g. /api/lla_app_bff/v1/}`
- **Method:** {POST JSON | …}
- **Android vs iOS host match:** {same | drift — describe}

| Env | Android | iOS | Match |
|-----|---------|-----|-------|
| Dev | `…` | `…` | same / drift |
| Staging | `…` | `…` | … |
| Pre-prod | `…` | `…` | … |
| Prod | `…` | `…` | … |

### Alternate hosts (not standard BFF prefix)

| API path | Platform | Base / host | Notes |
|----------|----------|-------------|-------|
| `{path}` | {A / iOS / both} | `{base or config key}` | {why HOST tag applies} |
```

Cross-market rules: [`02-cross-platform-contracts.md`](02-cross-platform-contracts.md) §1.

### 3 · Summary dashboard (HTML: KPI cards)

| Metric | Count |
|--------|------:|
| APIs in report | … |
| Contract match | … |
| Contract drift | … |
| Platform exclusive | … |
| High risk | … |
| Stale constants | … |
| Wired on both (integration audit, if available) | … |

Optional: L1 route split (shared / Android-only / iOS-only) when integration audit data exists for this market.

### 4 · Legend (HTML: integration + drift-type boxes)

**Contract status:** `same` · `drift` · `android-only` · `ios-only`

**Wiring** (independent axis):

| Status | Meaning |
|--------|---------|
| `integrated` | Path wired in Service / Repository at this SHA |
| `stale` | Constant exists but no Service wiring |
| `absent` | Not defined on that platform |

**Drift type tags:** `BODY` · `HDR` · `ROUTE` · `TYPE` · `CASE` · `LOC` · `HOST` · `CONTRACT`

### 5 · Stale constants (HTML: stale panel)

Omit section if none. One line per path:

```markdown
## Stale constants

- `{path}` — Android: **{status}** · iOS: **{status}**
```

### 6 · Category sections (HTML: one block per module)

**Agent:** Group APIs by domain inferred from Service / EndPoint modules in code (auth, account, payments, CMS, …). Use icons optionally; category names need not match a fixed list.

Under each `## {Category title}` section, summary table columns (same as HTML grid):

| Column | Content |
|--------|---------|
| API path | BFF relative path |
| Contract | `same` / `drift` / `android-only` / `ios-only` |
| Wiring A | `integrated` / `stale` / `absent` |
| Wiring iOS | same |
| Drift | space-separated tags or `—` |
| Android body | Short field summary |
| iOS body | Short field summary |
| Notes | Human note; type renames on separate sentence: `Types: \`Foo\` / \`Bar\`.` |

### 7 · Drift detail (HTML: expanded row)

For each high-severity drift row:

```markdown
### Drift detail

#### `{path}`

- **Contract:** …
- **Headers:** Android `…` · iOS `…`
- **Model evidence:** Android `{file:line}` · iOS `{file:line}`
- **Field drift:** {shared / type drift / platform-only fields}
- {actionable note}

<details><summary>Android source</summary>

```kotlin
{snippet from repo at SHA}
```

<details><summary>iOS source</summary>

```swift
{snippet from repo at SHA}
```
```

### 8 · Optional appendix (full audit)

| Section | HTML equivalent |
|---------|-----------------|
| `## Drift type reference` | Tag · meaning · example from **this** market |
| `## Baseline headers` | Interceptor / standard header table for **this** market |
| `## Patterns` | Recurring drift patterns seen in this report |

### 9 · Footer

```markdown
---
Generated by API contract drift workflow. See `docs/10-api-contract-drift.md`.
Market: {name} · SHAs: {android-short} / {ios-short}
```

---

## What to compare

1. **Body** — field names, types, nullability; type renames on same path  
2. **Headers** — beyond baseline for this market (`lob`, `uid`/`UID`, location in header vs body, …)  
3. **Route** — path on one platform only  
4. **Host / base URL** — same path, different root URL  
5. **Wiring** — Service integrated vs stale constant  

---

## Record keeping

- Full audit → canvas `canvases/<market-slug>-api-contract-drift.canvas.tsx` + slim `docs/reports/<market-slug>-api-contract-drift.md` + worklog row  
- Single API fix → PR description + optional worklog  
- Load-bearing contract facts → [`02-cross-platform-contracts.md`](02-cross-platform-contracts.md)  

---

## Scripted tooling (Phase 2 — local)

When `tools/lib/` is present on your machine:

| Script | Output |
|--------|--------|
| `./tools/api-drift-report-md.sh` | Slim Markdown summary only; set clones + SHAs via env |
| `./tools/api-drift-regen.sh` | Regenerate canvas data + parser tests |

See `docs/10-api-drift-audit.md` when that doc exists on your branch.
