import { Octokit } from "@octokit/core";
import { createAppAuth } from "@octokit/auth-app";
import { paginateRest } from "@octokit/plugin-paginate-rest";
import { retry } from "@octokit/plugin-retry";
import { throttling } from "@octokit/plugin-throttling";
import fetch from "node-fetch";
import * as core from "@actions/core";

/**
 * Creates and configures an Octokit instance with plugins and proper auth
 * @param {Object} config - Configuration object
 * @param {Object} config.auth - Auth configuration
 * @param {string} [config.auth.token] - GitHub token
 * @param {string} [config.auth.appId] - GitHub App ID
 * @param {string} [config.auth.privateKey] - GitHub App private key
 * @param {string} [config.auth.installationId] - GitHub App installation ID
 * @param {string} [config.apiUrl] - Custom API URL if needed
 * @param {boolean} [config.debug] - Enable debug logging
 * @returns {Octokit} - Configured Octokit instance
 */
export function getOctokit(config) {
  const { auth, apiUrl, debug } = config;

  if (!auth || (!auth.token && (!auth.appId || !auth.privateKey || !auth.installationId))) {
    throw new Error(
      "Invalid authentication configuration. Provide either token or appId, privateKey, and installationId"
    );
  }

  const MyOctokit = Octokit.plugin(paginateRest, retry, throttling);

  let octokitAuth = auth.token;
  if (auth.appId) {
    // Clone auth object to avoid mutation issues
    octokitAuth = { ...auth };
    delete octokitAuth.token;
  }

  return new MyOctokit({
    authStrategy: auth.appId ? createAppAuth : undefined,
    auth: octokitAuth,
    baseUrl: apiUrl,
    request: { fetch },
    log: debug ? console : undefined,
    throttle: {
      onRateLimit: (retryAfter, options, octokit, retryCount) => {
        core.warning(`Request quota exhausted for request ${options.method} ${options.url}`);

        if (retryCount < 1) {
          // only retries once
          core.info(`Retrying after ${retryAfter} seconds!`);
          return true;
        }
      },
      onSecondaryRateLimit: (retryAfter, options, octokit) => {
        // does not retry, only logs a warning
        core.warning(`SecondaryRateLimit detected for request ${options.method} ${options.url}`);
      },
      onAbuseLimit: (retryAfter, options, octokit) => {
        core.warning(`Abuse detected for request ${options.method} ${options.url}`);
        return true;
      },
    },
  });
}
