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
    ├── github-actions-metrics.js          # Scripted API — Actions runs, jobs, cache, artifacts
    ├── github-copilot-agent.js            # Scripted API — Copilot coding agent PR & issue tracking
    ├── github-actions-dashboard.json      # New Relic dashboard — Actions metrics
    └── github-copilot-agent-dashboard.json  # New Relic dashboard — Copilot agent metrics
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

Assets for collecting and visualising GitHub Actions and Copilot coding agent metrics in New Relic.

### github-actions-metrics.js

| Property | Value |
| --- | --- |
| Type | `SCRIPT_API` |
| Schedule | Once per day |
| Source | GitHub REST API v2022-11-28 |
| Target repo | `harrykimpel/O11yParty-Buzzer` |

Calls the GitHub REST API to collect the previous 25 hours of Actions data — workflow definitions, runs, jobs, cache usage, and artifacts — and forwards everything to New Relic as five custom event types.

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

**`GitHubActionsCache`** — one event per monitor run (point-in-time snapshot)

| Attribute | Description |
| --- | --- |
| `repo` | `owner/repo` |
| `activeCachesCount` | Number of active cache entries |
| `activeCachesSizeBytes` | Total size in bytes |
| `activeCachesSizeMb` | Total size in megabytes |

**`GitHubActionsArtifact`** — one event per artifact

| Attribute | Description |
| --- | --- |
| `repo` | `owner/repo` |
| `artifactId` / `artifactName` | GitHub artifact ID and name |
| `sizeBytes` / `sizeMb` | Storage consumed |
| `expired` | Whether the artifact has expired |
| `createdAt` / `expiresAt` | ISO timestamps |
| `workflowRunId` | Parent workflow run ID |

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

### github-copilot-agent.js

| Property | Value |
| --- | --- |
| Type | `SCRIPT_API` |
| Schedule | Once per day (or more frequently for near-real-time tracking) |
| Source | GitHub REST API v2022-11-28 |
| Target repo | `harrykimpel/O11yParty-Buzzer` |

Tracks the activity of the GitHub Copilot coding agent (`copilot-swe-agent`) in a repository. Collects PRs the agent authored and issues assigned to it within the lookback window, then forwards them to New Relic as custom events.

The Copilot coding agent operates as a standard GitHub user with login `copilot-swe-agent`. There is no dedicated session API — PR and issue lifecycle events are the only way to observe agent activity via the REST API.

#### Copilot Agent Event Types

**`GitHubCopilotAgentPR`** — one event per Copilot-authored PR updated in the lookback window

| Attribute | Description |
| --- | --- |
| `repo` | `owner/repo` |
| `prNumber` | PR number |
| `title` | PR title |
| `state` | `open` / `closed` |
| `merged` | Boolean — whether the PR was merged |
| `draft` | Boolean — whether the PR is a draft |
| `branch` / `baseBranch` | Head and base branch names |
| `labels` | Comma-separated label names |
| `commits` | Number of commits |
| `additions` / `deletions` / `changedFiles` | Code change size |
| `reviewComments` / `comments` | Review and general comment counts |
| `createdAt` / `updatedAt` / `closedAt` / `mergedAt` | ISO timestamps |
| `timeToMergeMs` | Milliseconds from creation to merge (null if not merged) |
| `timeToCloseMs` | Milliseconds from creation to close without merge (null if merged or open) |

**`GitHubCopilotAgentIssue`** — one event per issue assigned to the agent, updated in the lookback window

| Attribute | Description |
| --- | --- |
| `repo` | `owner/repo` |
| `issueNumber` | Issue number |
| `title` | Issue title |
| `state` | `open` / `closed` |
| `labels` | Comma-separated label names |
| `assignees` | Comma-separated assignee logins |
| `comments` | Number of comments |
| `createdAt` / `updatedAt` / `closedAt` | ISO timestamps |
| `timeToCloseMs` | Milliseconds from creation to close (null if still open) |

#### Copilot Agent Monitor Setup

Uses the same Secure Credentials as `github-actions-metrics.js` (`GITHUB_TOKEN`, `NR_INSERT_KEY`, `NR_ACCOUNT_ID`). No additional scopes required for public repos.

**Create the monitor** in New Relic Synthetics:

- Monitor type: **Scripted API**
- Schedule: **Once per day** (or every few hours to catch agent activity sooner)
- Paste the full contents of `github-copilot-agent.js`

#### Sample NRQL queries

```sql
-- All Copilot agent PRs and their outcome
SELECT prNumber, title, state, merged, timeToMergeMs / 60000 AS 'Time to merge (min)',
  additions, deletions, changedFiles
  FROM GitHubCopilotAgentPR SINCE 30 days ago LIMIT 100

-- Merge rate
SELECT percentage(count(*), WHERE merged = true) AS 'Merge Rate %'
  FROM GitHubCopilotAgentPR SINCE 30 days ago

-- Average time to merge (hours)
SELECT average(timeToMergeMs) / 3600000 AS 'Avg time to merge (hrs)'
  FROM GitHubCopilotAgentPR WHERE merged = true SINCE 30 days ago

-- PR volume over time
SELECT count(*) FROM GitHubCopilotAgentPR TIMESERIES 1 day SINCE 30 days ago

-- Open issues currently assigned to the agent
SELECT issueNumber, title, state, labels, createdAt
  FROM GitHubCopilotAgentIssue WHERE state = 'open' SINCE 90 days ago LIMIT 50

-- Code churn per agent PR
SELECT prNumber, title, additions + deletions AS 'Total churn'
  FROM GitHubCopilotAgentPR SINCE 30 days ago LIMIT 50
```

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

**Page 4 — Storage & Artifacts** (current snapshot + 30-day trend)

- Billboards: Cache Entries, Cache Size (MB), Active Artifacts, Artifact Storage (MB)
- Line charts: cache size and entry count trend (30-day)
- Bar: artifact storage by name
- Full artifacts table (name, size, expired, created/expiry dates)

#### Importing the dashboard

1. Replace every `NR_ACCOUNT_ID` in `github-actions-dashboard.json` with your numeric New Relic account ID
2. In New Relic, go to **Dashboards → Import dashboard**
3. Paste the updated contents of `github-actions-dashboard.json`

#### Dashboard NRQL queries

```sql
-- Daily run totals for the last 30 days
SELECT count(*) FROM GitHubActionsWorkflowRun
  FACET workflowName TIMESERIES 1 day SINCE 30 days ago

-- Total billable minutes per workflow
SELECT sum(billingMinutes) AS 'Billing Minutes'
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

-- Cache size trend
SELECT latest(activeCachesSizeMb) AS 'Cache (MB)', latest(activeCachesCount) AS 'Cache entries'
  FROM GitHubActionsCache TIMESERIES 1 day SINCE 30 days ago

-- Artifact storage by name
SELECT latest(sizeMb) AS 'Size (MB)' FROM GitHubActionsArtifact
  FACET artifactName SINCE 7 days ago
```

---

### github-copilot-agent-dashboard.json

A ready-to-import New Relic dashboard with three pages for observing the GitHub Copilot coding agent's behaviour and output.

**Page 1 — Overview** (30-day default window)

- Billboards: PRs Created, Merged PRs, Merge Rate %, Avg Time to Merge (hrs), Open Issues, Avg Time to Close Issue
- Area chart: PR activity over time by state
- Pie: PR state breakdown (Merged / Open / Closed without merge)
- Area chart: issue activity over time by state
- Bar: issues by label
- Table: recent agent PRs with churn and timing

**Page 2 — PR Details** (30-day / 90-day window)

- Billboards: Avg Additions, Avg Deletions, Avg Changed Files, Avg Review Comments per PR
- Bars: code churn per PR, changed files per PR, review comments per PR
- Line: time-to-merge trend over time
- Full PR table with all attributes (90-day window)

**Page 3 — Issues** (30-day / 90-day window)

- Billboards: Open Issues, Closed Issues, Avg Time to Close (hrs), Avg Comments
- Line: issue resolution trend over time
- Bar: issues by label
- Full issues table (90-day window)

#### Importing the Copilot agent dashboard

1. Replace every `NR_ACCOUNT_ID` in `github-copilot-agent-dashboard.json` with your numeric New Relic account ID
2. In New Relic, go to **Dashboards → Import dashboard**
3. Paste the updated contents of `github-copilot-agent-dashboard.json`

---

## Resources

- [New Relic Synthetics — Scripted API monitors](https://docs.newrelic.com/docs/synthetics/synthetic-monitoring/scripting-monitors/write-synthetic-api-tests/)
- [New Relic Synthetics — Scripted Browser monitors](https://docs.newrelic.com/docs/synthetics/synthetic-monitoring/scripting-monitors/introduction-scripted-browser-monitors/)
- [GitHub REST API — Actions](https://docs.github.com/en/rest/actions)
- [GitHub REST API — Copilot](https://docs.github.com/en/rest/copilot)
- [New Relic Events API](https://docs.newrelic.com/docs/data-apis/ingest-apis/event-api/introduction-event-api/)
