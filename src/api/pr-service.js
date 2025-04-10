import * as core from "@actions/core";

/**
 * Service class for handling PR-related operations
 */
class PRService {
  /**
   * Creates a new PRService instance
   * @param {Object} octokit - Authenticated Octokit instance
   */
  constructor(octokit) {
    this.octokit = octokit;
  }

  /**
   * Gets all non-draft pull requests for a given branch
   * @param {string} owner - Repository owner
   * @param {string} repo - Repository name
   * @param {string} baseBranch - Target branch to filter PRs by
   * @returns {Promise<Array>} - List of non-draft PRs
   */
  async getNonDraftPullRequests(owner, repo, baseBranch) {
    core.info(`Fetching open PRs targeting branch: ${baseBranch}`);

    try {
      const pullRequests = await this.octokit.paginate("GET /repos/{owner}/{repo}/pulls", {
        owner,
        repo,
        state: "open",
        base: baseBranch,
      });

      const nonDraftPRs = pullRequests.filter((pr) => !pr.draft);
      core.info(`Found ${nonDraftPRs.length} non-draft open PRs targeting branch ${baseBranch}`);

      return nonDraftPRs;
    } catch (error) {
      throw new Error(`Failed to fetch pull requests: ${error.message}`);
    }
  }

  /**
   * Gets all check suites for a commit reference
   * @param {string} owner - Repository owner
   * @param {string} repo - Repository name
   * @param {string} ref - Git reference (branch, commit SHA)
   * @returns {Promise<Array>} - List of GitHub Actions check suites
   */
  async getActionCheckSuites(owner, repo, ref) {
    core.debug(`Fetching check suites for ref: ${ref}`);

    try {
      const checkSuites = await this.octokit.paginate("GET /repos/{owner}/{repo}/commits/{ref}/check-suites", {
        owner,
        repo,
        ref,
      });

      // Filter for GitHub Actions check suites
      const actionsSuites = checkSuites.filter(
        (suite) => suite.app && (suite.app.name === "GitHub Actions" || suite.app.slug === "github-actions")
      );

      core.info(`Found ${actionsSuites.length} GitHub Actions check suites for ref ${ref}`);
      return actionsSuites;
    } catch (error) {
      throw new Error(`Failed to fetch check suites: ${error.message}`);
    }
  }

  /**
   * Gets all running workflow runs for a check suite
   * @param {string} owner - Repository owner
   * @param {string} repo - Repository name
   * @param {number} checkSuiteId - Check suite ID
   * @returns {Promise<Array>} - List of running workflow runs
   */
  async getRunningWorkflowRuns(owner, repo, checkSuiteId) {
    try {
      const workflowRuns = await this.octokit.paginate("GET /repos/{owner}/{repo}/actions/runs", {
        owner,
        repo,
        check_suite_id: checkSuiteId,
      });

      // Filter for running workflow runs (conclusion is null)
      const runningRuns = workflowRuns.filter((run) => run.conclusion === null);
      core.info(`Found ${runningRuns.length} running workflow runs for check suite ${checkSuiteId}`);

      return runningRuns;
    } catch (error) {
      throw new Error(`Failed to fetch workflow runs: ${error.message}`);
    }
  }

  /**
   * Cancels a workflow run
   * @param {string} owner - Repository owner
   * @param {string} repo - Repository name
   * @param {number} runId - Workflow run ID
   */
  async cancelWorkflowRun(owner, repo, runId) {
    try {
      core.info(`Cancelling workflow run ${runId}`);
      await this.octokit.request("POST /repos/{owner}/{repo}/actions/runs/{run_id}/cancel", {
        owner,
        repo,
        run_id: runId,
      });
    } catch (error) {
      core.error(`Failed to cancel workflow run ${runId}: ${error.message}`);
    }
  }

  /**
   * Process a check suite by finding and cancelling its running workflows
   * @param {string} owner - Repository owner
   * @param {string} repo - Repository name
   * @param {Object} suite - Check suite object
   * @param {number} prNumber - PR number associated with this suite
   */
  async processCheckSuite(owner, repo, suite, prNumber) {
    try {
      const runningRuns = await this.getRunningWorkflowRuns(owner, repo, suite.id);
      for (const run of runningRuns) {
        await this.cancelWorkflowRun(owner, repo, run.id);
      }
    } catch (error) {
      core.error(`Error processing check suite ${suite.id}: ${error.message}`);
    }
  }

  /**
   * Process an entire PR by finding and cancelling its running workflows
   * @param {string} owner - Repository owner
   * @param {string} repo - Repository name
   * @param {Object} pr - Pull request object
   */
  async processPR(owner, repo, pr) {
    const ref = pr.head.ref;
    core.info(`Processing PR with head ref: ${ref}`);

    try {
      const checkSuites = await this.getActionCheckSuites(owner, repo, ref);

      for (const suite of checkSuites) {
        await this.processCheckSuite(owner, repo, suite, pr.number);
      }
    } catch (error) {
      core.error(`Error processing PR ref ${ref}: ${error.message}`);
    }
  }
}

export default PRService;
