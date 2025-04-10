# Stop PR Jobs

A GitHub Action that cancels running workflow jobs for open PRs targeting a specific branch. This helps reduce unnecessary CI/CD resource usage by stopping superseded workflows.

## Usage

### Basic Example

```yaml
name: Stop PR Jobs

on:
  workflow_dispatch:
    inputs:
      branch:
        description: "Branch to check PRs against"
        required: true
        default: "main"
  # Or run on a schedule
  schedule:
    - cron: "*/10 * * * *" # Run every 10 minutes

permissions:
  actions: write
  checks: read
  pull-requests: read

jobs:
  stop-pr-jobs:
    runs-on: ubuntu-latest
    steps:
      - name: Cancel PR Jobs
        uses: jcantosz/stop-pr-jobs@main
        with:
          branch: ${{ github.event.inputs.branch || 'main' }}
          token: ${{ secrets.GITHUB_TOKEN }}
```

### With GitHub App Authentication (Recommended for higher API limits)

```yaml
name: Stop PR Jobs with GitHub App

on:
  schedule:
    - cron: "*/10 * * * *" # Run every 10 minutes

jobs:
  stop-pr-jobs:
    runs-on: ubuntu-latest
    steps:
      - name: Cancel PR Jobs
        uses: jcantosz/stop-pr-jobs@main
        with:
          branch: main
          app_id: ${{ secrets.APP_ID }}
          private_key: ${{ secrets.PRIVATE_KEY }}
          installation_id: ${{ secrets.INSTALLATION_ID }}
```

## Inputs

| Input             | Description                                              | Required | Default                    |
| ----------------- | -------------------------------------------------------- | -------- | -------------------------- |
| `branch`          | Base branch to check PRs against                         | Yes      | `main`                     |
| `token`           | GitHub token with appropriate permissions                | No\*     | `${{ github.token }}`      |
| `app_id`          | GitHub App ID (if using app authentication)              | No\*     | -                          |
| `private_key`     | GitHub App private key (if using app authentication)     | No\*     | -                          |
| `installation_id` | GitHub App installation ID (if using app authentication) | No\*     | -                          |
| `api_url`         | Custom GitHub API URL if using GitHub Enterprise         | No       | -                          |
| `repository`      | Repository in the format owner/repo                      | No       | `${{ github.repository }}` |

\* You must provide either a token OR app authentication details (all three app parameters).
