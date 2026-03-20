# Android Retrace Kibana Plugin — PoC Plan

## Goal

Demonstrate the feasibility of a Kibana plugin that deobfuscates Android R8 crash
stacktraces via a URL drilldown from a regular Kibana dashboard.

The user flow:
1. Open a Kibana dashboard showing a table of Android crash events
2. Click on a crash row → URL drilldown navigates to `/app/androidRetrace?doc_id=...`
3. The retrace plugin's UI page calls `POST /api/android/retrace` with the `doc_id`
4. The server-side handler fetches the crash document from ES, extracts the stacktrace,
   fetches R8 mapping data from `android-r8-mappings` index, runs the retrace algorithm
   in TypeScript, and returns the deobfuscated stacktrace
5. The UI renders the result in a syntax-highlighted code block alongside the original

## Key decisions

- **Document `_id` approach** — instead of passing the full stacktrace via URL query
  params (which would exceed browser URL length limits), the drilldown passes only the
  crash document's `_id`. The server-side handler fetches the document from ES to get
  the stacktrace. This keeps URLs short and clean.
- **KQL fallback** — ES|QL Lens panels support drilldown triggers at runtime (PR #253223)
  but the UI to add drilldowns is disabled. The dashboard can use a pre-configured NDJSON
  import for ES|QL, or fall back to a KQL Lens table where the drilldown UI works. Both
  are acceptable for the PoC.
- **No `build_id`** — the PoC uses a single mapping file from the integration test app,
  so all lookups query the `android-r8-mappings` index without filtering by `build_id`.

## Scope (PoC simplifications)

- **No `build_id`** — single mapping file assumed
- **No outline/rewriteFrame** — implement the core retrace algorithm (range matching,
  line interpolation, inline chains, default_mapping fallback) but skip the cross-frame
  R8 features (outline, outlineCallsite, rewriteFrame) for this PoC
- **Minimal UI** — a single page showing the deobfuscated stacktrace and the original
  for comparison. No nav integration, no flyout, no embeddable panel.
- **Simple dashboard** — one table panel showing crash events, with a URL drilldown
  configured to open the retrace page

## Data source

The integration test app from `elastic-otel-android` produces crash events in
`logs-generic.otel*` with these fields:

- `event_name`: `"app.crash"`
- `exception.stacktrace`: the full obfuscated Java stacktrace string
- `exception.type`: `"java.lang.RuntimeException"` (or similar)
- `service.name`: `"co.elastic.otel.android.integration"`
- `@timestamp`: event timestamp

R8 mapping data is in the `android-r8-mappings` index (lookup mode) with:
- `obfuscated_method_call`: `keyword` (e.g., `f8.b`)
- `mappings`: `keyword[]` (pipe-delimited range entries)
- `default_mapping`: `keyword` or null
- `build_id`: `keyword`

## Plugin location

```
x-pack/solutions/observability/plugins/android_retrace/
```

## Implementation steps

### Step 1: Plugin scaffold [DONE]

- `kibana.jsonc` — plugin manifest with `browser: true, server: true`
- `tsconfig.json` — extends @kbn/tsconfig-base
- `jest.config.js` — jest config
- `common/index.ts` — shared constants (PLUGIN_ID, MAPPING_INDEX, API path)
- `server/index.ts` — server entry point with config schema
- `server/plugin.ts` — creates HTTP router, registers routes
- `public/index.ts` — public entry point
- `public/plugin.ts` — registers `/app/androidRetrace` with `visibleIn: []`

### Step 2: Server-side retrace API [DONE]

`POST /api/android/retrace` with body `{ doc_id: string, index?: string }`:

1. Fetches the crash document by `_id` from the given index (default: `logs-generic.otel*`)
2. Extracts `exception.stacktrace` from the document
3. Parses unique method keys from the stacktrace
4. Fetches R8 mapping documents from `android-r8-mappings` (no `build_id` filter)
5. Runs the retrace algorithm (range match, interpolation, inline chains, default_mapping)
6. Returns `{ original: string, deobfuscated: string }`

Files:
- `server/routes/index.ts` — route registration hub
- `server/routes/retrace.ts` — route handler
- `server/lib/fetch_crash_doc.ts` — fetch crash doc by _id
- `server/lib/fetch_mappings.ts` — batch-fetch R8 mappings
- `server/lib/parse_mapping_entry.ts` — parse pipe-delimited mapping entries
- `server/lib/retrace.ts` — core retrace algorithm + extractMethodKeys utility
- `server/lib/handle_route_error.ts` — error handler

### Step 3: Client-side retrace page [DONE]

UI page at `/app/androidRetrace`:
- `public/app.tsx` — React app root with Router
- `public/views/retrace_view.tsx` — reads `doc_id` (and optional `index`) from URL
  query params, calls the retrace API, renders both deobfuscated and original stacktraces

### Step 4: Dashboard with URL drilldown [SETUP.md]

See `SETUP.md` in the plugin directory for full instructions. Summary:

**ES|QL approach** (preferred):
```esql
FROM logs-generic.otel* METADATA _id
| WHERE event_name == "app.crash"
| KEEP _id, @timestamp, service.name, exception.type, exception.stacktrace
| SORT @timestamp DESC
| LIMIT 50
```

URL drilldown template:
```
{{kibanaUrl}}/app/androidRetrace?doc_id={{event.values.[0]}}
```

The `_id` column is first, so `event.values.[0]` captures the document ID.

**KQL fallback**: standard Lens data table with `event_name: "app.crash"` filter,
where the drilldown UI is available.

### Step 5: Verify end-to-end

1. Start Kibana (`yarn start`)
2. Ensure integration test data exists in ES (crash events + R8 mappings)
3. Test the API directly via curl
4. Navigate to `/app/androidRetrace?doc_id=<DOC_ID>`
5. Optionally create the dashboard and test the drilldown flow
