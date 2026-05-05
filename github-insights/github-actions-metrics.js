/**
 * New Relic Synthetics - Scripted API Monitor
 * Scrapes GitHub Actions usage metrics (Workflows + Jobs tabs) for a given repo
 * and forwards them as custom New Relic events.
 *
 * Required Secure Credentials (Synthetics > Secure Credentials):
 *   GITHUB_TOKEN   - GitHub personal access token (repo / read:org scope)
 *   NR_INSERT_KEY  - New Relic Ingest - License key (or Insights Insert key)
 *
 * Monitor schedule: once per day
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

// How many hours back to look for workflow runs (matches daily cadence + buffer)
var LOOKBACK_HOURS = 25;

// Limit jobs fetched per run to avoid hitting API rate limits on large repos
var MAX_RUNS_FOR_JOB_FETCH = 30;
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
      callback(null, JSON.parse(body));
    }
  );
}

function postEvents(events, callback) {
  if (events.length === 0) return callback(null);

  // Events API accepts up to 1 MB / 1 000 events per request
  var BATCH = 1000;
  var pending = Math.ceil(events.length / BATCH);
  var failed = false;

  for (var i = 0; i < events.length; i += BATCH) {
    (function (batch) {
      $http.post(
        {
          url: NR_EVENTS_URL,
          headers: {
            'X-Insert-Key': NR_INSERT_KEY,
            'Content-Type': 'application/json'
          },
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

function durationMs(start, end) {
  if (!start || !end) return null;
  return new Date(end) - new Date(start);
}

function epochSec(isoString) {
  return Math.floor(new Date(isoString).getTime() / 1000);
}

// ── Step 1: fetch workflow definitions ───────────────────────────────────────

githubGet(REPO_PATH + '/actions/workflows?per_page=100', function (err, data) {
  assert.ifError(err);

  var workflows = data.workflows || [];
  console.log('Workflows found:', workflows.length);

  var workflowEvents = workflows.map(function (wf) {
    return {
      eventType: 'GitHubActionsWorkflow',
      repo: GITHUB_OWNER + '/' + GITHUB_REPO,
      workflowId: wf.id,
      workflowName: wf.name,
      state: wf.state,
      path: wf.path,
      url: wf.html_url,
      timestamp: epochSec(wf.updated_at)
    };
  });

  // Build a lookup map: workflowId → workflowName
  var workflowNames = {};
  workflows.forEach(function (wf) { workflowNames[wf.id] = wf.name; });

  // ── Step 2: fetch workflow runs from the last LOOKBACK_HOURS ───────────────

  githubGet(
    REPO_PATH + '/actions/runs?per_page=100&created=>=' + since,
    function (err, data) {
      assert.ifError(err);

      var runs = data.workflow_runs || [];
      console.log('Workflow runs found:', runs.length);

      var runEvents = runs.map(function (run) {
        return {
          eventType: 'GitHubActionsWorkflowRun',
          repo: GITHUB_OWNER + '/' + GITHUB_REPO,
          runId: run.id,
          workflowId: run.workflow_id,
          workflowName: workflowNames[run.workflow_id] || run.name,
          status: run.status,
          conclusion: run.conclusion || 'in_progress',
          triggerEvent: run.event,
          branch: run.head_branch,
          actor: run.actor ? run.actor.login : '',
          runNumber: run.run_number,
          runAttempt: run.run_attempt,
          durationMs: durationMs(run.created_at, run.updated_at),
          createdAt: run.created_at,
          updatedAt: run.updated_at,
          timestamp: epochSec(run.created_at)
        };
      });

      // ── Step 3: fetch jobs for the most recent runs ──────────────────────

      var recentRuns = runs.slice(0, MAX_RUNS_FOR_JOB_FETCH);
      var jobEvents = [];
      var remaining = recentRuns.length;

      function onAllJobsFetched() {
        console.log('Jobs found:', jobEvents.length);

        var allEvents = workflowEvents.concat(runEvents).concat(jobEvents);
        console.log('Total events to post:', allEvents.length);

        postEvents(allEvents, function (err) {
          assert.ifError(err);
          console.log('Successfully posted', allEvents.length, 'events to New Relic.');
        });
      }

      if (remaining === 0) {
        onAllJobsFetched();
        return;
      }

      recentRuns.forEach(function (run) {
        githubGet(
          REPO_PATH + '/actions/runs/' + run.id + '/jobs?per_page=100',
          function (err, data) {
            if (!err && data && data.jobs) {
              data.jobs.forEach(function (job) {
                jobEvents.push({
                  eventType: 'GitHubActionsJob',
                  repo: GITHUB_OWNER + '/' + GITHUB_REPO,
                  jobId: job.id,
                  runId: job.run_id,
                  workflowName: workflowNames[run.workflow_id] || run.name,
                  jobName: job.name,
                  status: job.status,
                  conclusion: job.conclusion || 'in_progress',
                  runnerName: job.runner_name || '',
                  runnerGroupName: job.runner_group_name || '',
                  durationMs: durationMs(job.started_at, job.completed_at),
                  startedAt: job.started_at || '',
                  completedAt: job.completed_at || '',
                  timestamp: job.started_at ? epochSec(job.started_at) : Math.floor(Date.now() / 1000)
                });
              });
            } else if (err) {
              console.warn('Could not fetch jobs for run', run.id, err.message);
            }

            if (--remaining === 0) onAllJobsFetched();
          }
        );
      });
    }
  );
});
