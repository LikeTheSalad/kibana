# Android Retrace Plugin — Setup Guide

## Prerequisites

- The `android-r8-mappings` lookup index must exist in Elasticsearch, populated by
  the EDOT Android Gradle plugin's `releaseUploadMapToElasticsearch` task.
- Crash events must exist in `logs-generic.otel*` with `event_name: "app.crash"` and
  `exception.stacktrace` fields.
- Both can be produced by running the integration test in the `elastic-otel-android` repo.

## 1. Start Kibana with the plugin

From the Kibana repo root:

```bash
yarn kbn bootstrap
yarn start
```

The plugin is auto-discovered from `x-pack/solutions/observability/plugins/android_retrace/`.

## 2. Test the retrace API directly

First, find a crash document ID:

```bash
curl -s -X POST "http://localhost:9200/logs-generic.otel*/_search" \
  -H "Content-Type: application/json" \
  -d '{
    "query": {"term": {"event_name": "app.crash"}},
    "_source": false,
    "size": 1
  }' | jq '.hits.hits[0]._id'
```

Then call the retrace API (replace `<DOC_ID>` with the actual ID):

```bash
curl -s -X POST "http://localhost:5601/api/android/retrace" \
  -H "kbn-xsrf: true" \
  -H "Content-Type: application/json" \
  -H "Authorization: Basic $(echo -n 'elastic:changeme' | base64)" \
  -d '{"doc_id": "<DOC_ID>"}' | jq .
```

## 3. Test the UI page directly

Navigate to the retrace page (replace `<DOC_ID>` with the actual ID):

```
http://localhost:5601/app/androidRetrace?doc_id=<DOC_ID>
```

This should show the deobfuscated stacktrace alongside the original.

## 4. Create the dashboard with URL drilldown

### 4a. Create the dashboard

1. Open Kibana → **Dashboards** → **Create dashboard**
2. Click **Create visualization**
3. Switch to **ES|QL** mode (toggle in the data panel)
4. Enter this query:

```esql
FROM logs-generic.otel* METADATA _id
| WHERE event_name == "app.crash"
| KEEP _id, @timestamp, service.name, exception.type, exception.stacktrace
| SORT @timestamp DESC
| LIMIT 50
```

5. Choose **Table** as the visualization type
6. Save the visualization to the dashboard

### 4b. Add the URL drilldown

> **Note:** The Kibana UI for adding drilldowns may be disabled for ES|QL panels.
> If so, use the **KQL fallback** (4c) or import a pre-configured dashboard JSON.

For **KQL fallback** where the drilldown UI is available:

1. Edit the panel → **Drilldowns** → **Create drilldown** → **Go to URL**
2. Name: `Deobfuscate stacktrace`
3. Trigger: **Table row click**
4. URL template:
   ```
   {{kibanaUrl}}/app/androidRetrace?doc_id={{event.values.[0]}}
   ```
5. Check **Open in new tab** (recommended)

### 4c. KQL fallback dashboard

If ES|QL drilldowns are not available in the UI:

1. Create a **Lens** data table (not ES|QL mode)
2. Index pattern: `logs-generic.otel*`
3. Add a KQL filter: `event_name: "app.crash"`
4. Add columns: `@timestamp`, `service.name`, `exception.type`, `exception.stacktrace`
5. The drilldown can pass the document's `_id` if the Lens table provides it.

**Limitation:** Standard KQL Lens tables don't expose `_id` as a column. The
practical workaround for the PoC is to navigate directly to:
```
http://localhost:5601/app/androidRetrace?doc_id=<DOC_ID>
```

### 4d. Dashboard JSON import (advanced)

For a fully pre-configured dashboard with the drilldown embedded, use the
Kibana Saved Objects import API with an NDJSON file. See `dashboards/` directory
(if available) or create one by:

1. Set up the dashboard manually (4a + 4b)
2. **Stack Management** → **Saved Objects** → select the dashboard → **Export**
3. The exported NDJSON can be re-imported in any Kibana instance

## 5. URL drilldown variable reference

For `ROW_CLICK_TRIGGER`, the URL template has access to:

| Variable | Description |
|----------|-------------|
| `{{kibanaUrl}}` | Current Kibana origin + base path (safe across deployments) |
| `{{event.values.[N]}}` | Cell value at column index N (0-based) |
| `{{event.keys.[N]}}` | ES field name at column index N |
| `{{event.columnNames.[N]}}` | Display name at column index N |
| `{{event.rowIndex}}` | Row index in the table |

With `_id` as the first column in the ES|QL query, `{{event.values.[0]}}` gives the
document ID.

## Running tests

```bash
node scripts/jest x-pack/solutions/observability/plugins/android_retrace
```
