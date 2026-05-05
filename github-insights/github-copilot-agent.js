/**
 * New Relic Synthetics - Scripted API Monitor
 * Tracks GitHub Copilot coding agent activity: PRs it authored and issues
 * assigned to it. Sends results as custom New Relic events.
 *
 * Required Secure Credentials (Synthetics > Secure Credentials):
 *   GITHUB_TOKEN   - GitHub personal access token (repo / read:org scope)
 *   NR_INSERT_KEY  - New Relic Ingest - License key (or Insights Insert key)
 *   NR_ACCOUNT_ID  - New Relic account ID
 *
 * Monitor schedule: once per day (or more frequently for near-real-time tracking)
 * Docs: https://docs.newrelic.com/docs/synthetics/synthetic-monitoring/scripting-monitors/write-synthetic-api-tests/
 */

//monitorType: SCRIPT_API

var assert = require('assert');

// ── Configuration ─────────────────────────────────────────────────────────────
var GITHUB_OWNER = 'harrykimpel';
var GITHUB_REPO = 'O11yParty-Buzzer';
var GITHUB_TOKEN = $secure.GITHUB_TOKEN;
var NR_INSERT_KEY = $secure.NR_INSERT_KEY;
var NR_ACCOUNT_ID = $secure.NR_ACCOUNT_ID;

// GitHub user login for the Copilot coding agent
var COPILOT_AGENT_LOGIN = 'copilot-swe-agent';

// Only collect items updated within this window (matches daily cadence + buffer)
var LOOKBACK_HOURS = 25;
// ─────────────────────────────────────────────────────────────────────────────

var NR_EVENTS_URL = 'https://insights-collector.newrelic.com/v1/accounts/' + NR_ACCOUNT_ID + '/events';
var GITHUB_API = 'https://api.github.com';
var REPO_PATH = '/repos/' + GITHUB_OWNER + '/' + GITHUB_REPO;

var since = new Date(Date.now() - LOOKBACK_HOURS * 60 * 60 * 1000).toISOString();

var githubHeaders = {
  'Authorization': 'Bearer ' + GITHUB_TOKEN,
  'Accept': 'application/vnd.github+json',
  'X-GitHub-Api-Version': '2022-11-28',
  'User-Agent': 'NewRelic-Synthetics-Monitor'
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function githubGet(path, callback) {
  $http.get(
    { url: GITHUB_API + path, headers: githubHeaders },
    function (err, response, body) {
      if (err) return callback(err);
      assert.equal(response.statusCode, 200, 'GitHub API error ' + response.statusCode + ' for ' + path);
      callback(null, JSON.parse(JSON.stringify(body)));
    }
  );
}

function postEvents(events, callback) {
  if (events.length === 0) {
    console.log('No events to post.');
    return callback(null);
  }

  var BATCH = 1000;
  var pending = Math.ceil(events.length / BATCH);
  var failed = false;

  for (var i = 0; i < events.length; i += BATCH) {
    (function (batch) {
      $http.post(
        {
          url: NR_EVENTS_URL,
          headers: { 'X-Insert-Key': NR_INSERT_KEY, 'Content-Type': 'application/json' },
          body: JSON.stringify(batch)
        },
        function (err, response) {
          if (err || (response && response.statusCode >= 300)) {
            console.error('NR ingest error:', err || response.statusCode);
            failed = true;
          }
          if (--pending === 0) callback(failed ? new Error('NR ingest failed') : null);
        }
      );
    })(events.slice(i, i + BATCH));
  }
}

function epochSec(isoString) {
  return Math.floor(new Date(isoString).getTime() / 1000);
}

function diffMs(start, end) {
  if (!start || !end) return null;
  return new Date(end) - new Date(start);
}

function labelNames(labels) {
  if (!labels || labels.length === 0) return '';
  return labels.map(function (l) { return l.name; }).join(', ');
}

// ── Step 1: fetch Copilot-authored PRs updated since the lookback window ──────

githubGet(
  REPO_PATH + '/pulls?state=all&sort=updated&direction=desc&per_page=100',
  function (err, pulls) {
    assert.ifError(err);

    // Filter to agent-authored PRs updated within the lookback window
    var agentPulls = pulls.filter(function (pr) {
      return pr.user && pr.user.login === COPILOT_AGENT_LOGIN
        && pr.updated_at >= since;
    });

    console.log('Copilot agent PRs updated in window:', agentPulls.length);

    if (agentPulls.length === 0) {
      return fetchIssues([]);
    }

    // Fetch full detail for each PR (adds additions/deletions/changed_files/review_comments)
    var prEvents = [];
    var remaining = agentPulls.length;

    agentPulls.forEach(function (pr) {
      githubGet(REPO_PATH + '/pulls/' + pr.number, function (err, detail) {
        if (!err && detail) {
          var merged = !!detail.merged_at;
          prEvents.push({
            eventType: 'GitHubCopilotAgentPR',
            repo: GITHUB_OWNER + '/' + GITHUB_REPO,
            prNumber: detail.number,
            title: detail.title,
            state: detail.state,
            merged: merged,
            draft: detail.draft,
            branch: detail.head ? detail.head.ref : '',
            baseBranch: detail.base ? detail.base.ref : '',
            labels: labelNames(detail.labels),
            commits: detail.commits || 0,
            additions: detail.additions || 0,
            deletions: detail.deletions || 0,
            changedFiles: detail.changed_files || 0,
            reviewComments: detail.review_comments || 0,
            comments: detail.comments || 0,
            createdAt: detail.created_at,
            updatedAt: detail.updated_at,
            closedAt: detail.closed_at || '',
            mergedAt: detail.merged_at || '',
            timeToMergeMs: diffMs(detail.created_at, detail.merged_at),
            timeToCloseMs: !merged ? diffMs(detail.created_at, detail.closed_at) : null,
            timestamp: epochSec(detail.created_at)
          });
        } else if (err) {
          console.warn('Could not fetch PR detail for #' + pr.number + ':', err.message);
        }

        if (--remaining === 0) fetchIssues(prEvents);
      });
    });
  }
);

// ── Step 2: fetch issues assigned to the Copilot agent ───────────────────────

function fetchIssues(prEvents) {
  githubGet(
    REPO_PATH + '/issues?assignee=' + COPILOT_AGENT_LOGIN + '&state=all&since=' + since + '&per_page=100',
    function (err, items) {
      assert.ifError(err);

      // The issues endpoint also returns PRs — exclude them
      var issues = items.filter(function (item) {
        return !item.pull_request;
      });

      console.log('Copilot agent issues updated in window:', issues.length);

      var issueEvents = issues.map(function (issue) {
        return {
          eventType: 'GitHubCopilotAgentIssue',
          repo: GITHUB_OWNER + '/' + GITHUB_REPO,
          issueNumber: issue.number,
          title: issue.title,
          state: issue.state,
          labels: labelNames(issue.labels),
          assignees: issue.assignees
            ? issue.assignees.map(function (a) { return a.login; }).join(', ')
            : '',
          comments: issue.comments || 0,
          createdAt: issue.created_at,
          updatedAt: issue.updated_at,
          closedAt: issue.closed_at || '',
          timeToCloseMs: diffMs(issue.created_at, issue.closed_at),
          timestamp: epochSec(issue.created_at)
        };
      });

      // ── Step 3: post all events ─────────────────────────────────────────────

      var allEvents = prEvents.concat(issueEvents);
      console.log('Total Copilot agent events to post:', allEvents.length);

      postEvents(allEvents, function (err) {
        assert.ifError(err);
        console.log('Successfully posted', allEvents.length, 'Copilot agent events to New Relic.');
      });
    }
  );
}
