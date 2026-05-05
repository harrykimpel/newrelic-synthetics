# New Relic Synthetics Samples

A collection of New Relic Synthetics scripted monitor scripts and supporting assets.

## Repository Structure

```text
newrelic-synthetics/
├── kimpel.com.js               # Scripted Browser — kimpel.com homepage
├── kimpel.com-about.js         # Scripted Browser — kimpel.com /about page
├── jsonplaceholder-users-5.js  # Scripted API — JSONPlaceholder API check
├── on-the-beach.js             # Scripted Browser — On the Beach search flow
└── github-insights/
    ├── github-actions-metrics.js      # Scripted API — GitHub Actions usage collector
    └── github-actions-dashboard.json  # New Relic dashboard definition
```

---

## Scripts

### kimpel.com.js

| Property | Value |
| --- | --- |
| Type | `SCRIPT_BROWSER` |
| Target | <https://www.kimpel.com/> |

Loads the kimpel.com homepage, locates the `<h1>` element, and asserts that the top navigation logo link resolves to `https://www.kimpel.com/`.

---

### kimpel.com-about.js

| Property | Value |
| --- | --- |
| Type | `SCRIPT_BROWSER` |
| Target | <https://www.kimpel.com/about> |

Loads the `/about` page and asserts that the header navigation link points back to the homepage.

---

### jsonplaceholder-users-5.js

| Property | Value |
| --- | --- |
| Type | `SCRIPT_API` |
| Target | <http://jsonplaceholder.typicode.com/users/5> |

Simple availability check against the JSONPlaceholder public API. Asserts a `200 OK` response and that the returned JSON body contains `id: 5`.

---

### on-the-beach.js

| Property | Value |
| --- | --- |
| Type | `SCRIPT_BROWSER` |
| Target | <https://www.onthebeach.co.uk/> |

End-to-end scripted browser test for the On the Beach holiday search flow. Generated via the New Relic Synthetics Formatter for Selenium IDE. Performs a destination search for "Munich", selects a result, and validates the search journey. Includes a step logger utility that can optionally post step timings to New Relic as custom events.

---

## github-insights/

Assets for collecting and visualising GitHub Actions usage metrics in New Relic.

### github-actions-metrics.js

| Property | Value |
| --- | --- |
| Type | `SCRIPT_API` |
| Schedule | Once per day |
| Source | GitHub REST API v2022-11-28 |
| Target repo | `harrykimpel/O11yParty-Buzzer` |

Calls the GitHub REST API to collect the previous 25 hours of Actions data (workflows, runs, and jobs) and forwards everything to New Relic as three custom event types.

#### Custom Event Types

**`GitHubActionsWorkflow`** — one event per workflow definition

| Attribute | Description |
| --- | --- |
| `repo` | `owner/repo` |
| `workflowId` | GitHub workflow ID |
| `workflowName` | Display name |
| `state` | `active` / `disabled_manually` / etc. |
| `path` | YAML file path in the repo |
| `url` | Link to the workflow on GitHub |

**`GitHubActionsWorkflowRun`** — one event per workflow run in the lookback window

| Attribute | Description |
| --- | --- |
| `repo` | `owner/repo` |
| `runId` | GitHub run ID |
| `workflowId` / `workflowName` | Parent workflow |
| `status` | `queued` / `in_progress` / `completed` |
| `conclusion` | `success` / `failure` / `cancelled` / `timed_out` / `in_progress` |
| `triggerEvent` | `push` / `pull_request` / `schedule` / etc. |
| `branch` | Head branch |
| `actor` | GitHub username that triggered the run |
| `runNumber` / `runAttempt` | Run number and retry count |
| `durationMs` | Wall-clock duration in milliseconds |
| `createdAt` / `updatedAt` | ISO timestamps |

**`GitHubActionsJob`** — one event per job (up to 30 most recent runs)

| Attribute | Description |
| --- | --- |
| `repo` | `owner/repo` |
| `jobId` / `runId` | GitHub IDs |
| `workflowName` / `jobName` | Display names |
| `status` / `conclusion` | Same values as workflow run |
| `runnerName` / `runnerGroupName` | Runner details |
| `runnerOs` | Detected OS: `Linux`, `Windows`, or `macOS` (derived from job labels) |
| `billingMultiplier` | GitHub rate: Linux=1, Windows=2, macOS=10 |
| `durationMs` | Raw job duration in milliseconds |
| `billingMinutes` | `ceil(durationMs / 60000) × billingMultiplier` — matches GitHub's billed minutes |
| `startedAt` / `completedAt` | ISO timestamps |

#### Setup

**1. Secure Credentials** — add these in Synthetics > Secure Credentials:

| Credential key | Value |
| --- | --- |
| `GITHUB_TOKEN` | GitHub personal access token with `repo` (or `public_repo`) scope |
| `NR_INSERT_KEY` | New Relic Ingest — License key |
| `NR_ACCOUNT_ID` | Your New Relic account ID |

**2. Configuration** — edit the top of the script if targeting a different repository:

```js
var GITHUB_OWNER = 'harrykimpel';
var GITHUB_REPO  = 'O11yParty-Buzzer';
```

**3. Create the monitor** in New Relic Synthetics:

- Monitor type: **Scripted API**
- Schedule: **Once per day**
- Paste the full contents of `github-actions-metrics.js`

---

### github-actions-dashboard.json

A ready-to-import New Relic dashboard with three pages/tabs.

**Page 1 — Overview** (7-day default window)

- Billboards row 1: Total Workflow Runs, Total Job Runs, Raw Minutes Used, GitHub Billing Minutes
- Billboards row 2: Success Rate %, Avg Job Duration, Failed Runs
- Area chart: runs over time by conclusion
- Pie: runs by conclusion
- Bar charts: top workflows by run count, jobs by status
- Bar: minutes used per day (30-day trend)
- Table: recent failed / cancelled / timed-out runs

**Page 2 — Workflow Details** (30-day window)

- Bars: run count and avg duration per workflow
- Line: run trend per workflow over time
- Bar: failure rate % per workflow
- Breakdowns by trigger event, actor, and branch
- Full workflow runs table

**Page 3 — Job Details** (30-day window)

- Billboards row 1: Total Jobs, Raw Minutes, GitHub Billing Minutes, Failed Jobs
- Billboards row 2: Avg Job Duration, Unique Job Types, P95 Duration
- Bars: top jobs by count, avg duration by job name
- Area: jobs over time by conclusion
- Pie: jobs by runner group
- Bar: billing minutes by runner OS
- Bars: failure rate by workflow, jobs by runner name
- Full jobs table (includes `runnerOs`, `billingMultiplier`, `billingMinutes`)

#### Importing the dashboard

1. Replace every `NR_ACCOUNT_ID` in `github-actions-dashboard.json` with your numeric New Relic account ID
2. In New Relic, go to **Dashboards → Import dashboard**
3. Paste the updated contents of `github-actions-dashboard.json`

#### Sample NRQL queries

```sql
-- Daily run totals for the last 30 days
SELECT count(*) FROM GitHubActionsWorkflowRun
  FACET workflowName TIMESERIES 1 day SINCE 30 days ago

-- Total billable minutes per workflow
SELECT sum(durationMs) / 60000 AS 'Minutes'
  FROM GitHubActionsJob FACET workflowName SINCE 30 days ago

-- Success rate trend
SELECT percentage(count(*), WHERE conclusion = 'success') AS 'Success %'
  FROM GitHubActionsWorkflowRun TIMESERIES 1 day SINCE 30 days ago

-- Slowest jobs (P95)
SELECT percentile(durationMs, 95) / 60000 AS 'P95 (min)'
  FROM GitHubActionsJob FACET jobName SINCE 30 days ago LIMIT 20

-- All failures in the last week
SELECT workflowName, branch, actor, conclusion, createdAt
  FROM GitHubActionsWorkflowRun
  WHERE conclusion IN ('failure', 'cancelled', 'timed_out')
  SINCE 7 days ago LIMIT 100
```

---

## Resources

- [New Relic Synthetics — Scripted API monitors](https://docs.newrelic.com/docs/synthetics/synthetic-monitoring/scripting-monitors/write-synthetic-api-tests/)
- [New Relic Synthetics — Scripted Browser monitors](https://docs.newrelic.com/docs/synthetics/synthetic-monitoring/scripting-monitors/introduction-scripted-browser-monitors/)
- [GitHub REST API — Actions](https://docs.github.com/en/rest/actions)
- [New Relic Events API](https://docs.newrelic.com/docs/data-apis/ingest-apis/event-api/introduction-event-api/)
