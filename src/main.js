import { getOctokit } from "./api/github-client.js";
import PRService from "./api/pr-service.js";
import * as core from "@actions/core";

/**
 * Loads and validates configuration from GitHub Actions inputs
 */
function loadConfig() {
  const config = {
    branch: core.getInput("branch"),
    repository: core.getInput("repository") || process.env.GITHUB_REPOSITORY || "",
    apiUrl: core.getInput("api_url") || undefined,
    debug: core.isDebug(),
  };

  // Authentication config
  const auth = {};
  const token = core.getInput("github_token");
  const appId = core.getInput("app_id");
  const privateKey = core.getInput("private_key");
  const installationId = core.getInput("installation_id");

  // Set auth properties
  if (token) {
    auth.token = token;
  }
  if (appId && privateKey && installationId) {
    auth.appId = appId;
    auth.privateKey = privateKey;
    auth.installationId = installationId;
  }

  console.log(JSON.stringify(auth));
  validateConfig(config, auth);
  config.auth = auth;
  return config;
}

/**
 * Validates configuration and throws if invalid
 */
function validateConfig(config, auth) {
  const errors = [];

  if (!config.branch) {
    errors.push("Branch is required");
  }

  if (!config.repository) {
    errors.push("Repository is required");
  } else if (!config.repository.includes("/")) {
    errors.push("Repository must be in the format owner/repo");
  }

  if (Object.keys(auth).length === 0) {
    errors.push("Authentication is required. Provide either token or app credentials.");
  } else if (auth.appId && (!auth.privateKey || !auth.installationId)) {
    errors.push("When using GitHub App authentication, appId, privateKey, and installationId are all required");
  }

  if (errors.length > 0) {
    throw new Error(`Configuration errors:\n${errors.join("\n")}`);
  }
}

/**
 * Main action function
 */
export default async function main() {
  try {
    // Load configuration
    const config = loadConfig();
    core.debug("Configuration loaded successfully");

    // Extract repository owner and name
    const [owner, repo] = config.repository.split("/");

    // Create GitHub client
    const octokit = getOctokit({
      auth: config.auth,
      apiUrl: config.apiUrl,
      debug: config.debug,
    });
    core.debug("GitHub client created successfully");

    // Create PR service instance
    const prService = new PRService(octokit);

    // Get all non-draft open PRs for the branch
    const prs = await prService.getNonDraftPullRequests(owner, repo, config.branch);

    // Process each PR using the PR service
    for (const pr of prs) {
      prService.processPR(owner, repo, pr, config.dryRun);
    }

    core.setOutput("prs_processed", prs.length);
  } catch (error) {
    core.setFailed(`Action failed: ${error.message}`);

    if (error.stack) {
      core.debug(error.stack);
    }
  }
}
