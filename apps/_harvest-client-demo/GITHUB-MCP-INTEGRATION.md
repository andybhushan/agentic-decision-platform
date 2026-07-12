# GitHub MCP Server Integration

## Overview

The GitHub MCP (Model Context Protocol) server has been integrated into this project to provide AI assistants with direct GitHub API access. This complements the existing custom GitHub Projects v2 reporting API by enabling general GitHub operations.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     AI Assistant (Bob)                       │
└─────────────────────────────────────────────────────────────┘
                              │
                ┌─────────────┴─────────────┐
                │                           │
                ▼                           ▼
┌───────────────────────────┐   ┌─────────────────────────────┐
│   GitHub MCP Server       │   │  Custom Reporting API       │
│   (General Operations)    │   │  (Projects v2 Analytics)    │
├───────────────────────────┤   ├─────────────────────────────┤
│ • Create/Update Issues    │   │ • Executive Reports         │
│ • Manage Labels           │   │ • Milestone Tracking        │
│ • Create Pull Requests    │   │ • Blocker Detection         │
│ • Fork Repositories       │   │ • Dependency Analysis       │
│ • Search Code/Issues      │   │ • PowerPoint Export         │
│ • File Operations         │   │                             │
└───────────────────────────┘   └─────────────────────────────┘
                │                           │
                └─────────────┬─────────────┘
                              ▼
                    ┌──────────────────┐
                    │   GitHub API     │
                    └──────────────────┘
```

## Configuration

The GitHub MCP server is configured in `C:\Users\RichardHogan\.bob\settings\mcp_settings.json`:

```json
{
  "mcpServers": {
    "github": {
      "command": "mcp-server-github",
      "args": [],
      "env": {
        "GITHUB_PERSONAL_ACCESS_TOKEN": "ghp_..."
      },
      "disabled": false,
      "alwaysAllow": [],
      "disabledTools": []
    }
  }
}
```

## Available GitHub MCP Tools

Once connected, the following tools become available to AI assistants:

### Issue Management
- **create_issue** - Create new issues with labels, assignees, milestones
- **update_issue** - Update existing issues (title, body, state, labels)
- **add_issue_comment** - Add comments to issues
- **list_issues** - List and filter repository issues
- **get_issue** - Get detailed information about a specific issue
- **search_issues** - Search for issues across repositories

### Pull Request Operations
- **create_pull_request** - Create new pull requests
- **get_pull_request** - Get PR details
- **list_pull_requests** - List and filter PRs
- **create_pull_request_review** - Create PR reviews with comments
- **merge_pull_request** - Merge approved PRs
- **get_pull_request_files** - List files changed in a PR
- **get_pull_request_status** - Get PR status checks
- **update_pull_request_branch** - Update PR branch with base changes
- **get_pull_request_comments** - Get PR review comments
- **get_pull_request_reviews** - Get PR reviews

### Repository Operations
- **create_repository** - Create new repositories
- **search_repositories** - Search for repositories
- **fork_repository** - Fork repositories
- **create_branch** - Create new branches
- **list_commits** - List commits in a branch

### File Operations
- **get_file_contents** - Read file contents from repositories
- **create_or_update_file** - Create or update single files
- **push_files** - Push multiple files in a single commit

### Search Operations
- **search_code** - Search for code across repositories
- **search_users** - Search for GitHub users

## Recommended Usage Patterns

### 1. Automated Issue Management

**Use Case**: Automatically create and label issues based on report findings

```
Example Command: "Create a blocker issue for the Demo Environment Freeze task"

AI Assistant will:
1. Use create_issue tool with appropriate labels (risk:blocker, stage-gate:3)
2. Set assignees and milestone
3. Link to related issues in the description
4. The issue automatically appears in your executive reports
```

### 2. Workflow Automation

**Use Case**: Streamline PR creation and review process

```
Example Command: "Create a PR for the export feature improvements"

AI Assistant will:
1. Use create_pull_request to create the PR
2. Add appropriate labels and reviewers
3. Link to related issues
4. Set up PR description with changes summary
```

### 3. Label-Based Reporting Integration

**Use Case**: Manage risk labels that feed into executive reports

```
Example Command: "Add risk:blocker label to issue #123"

AI Assistant will:
1. Use update_issue to add the label
2. The blocker detection in your reporting API automatically picks it up
3. Issue appears in the next executive report export
```

### 4. Code Search and Analysis

**Use Case**: Find code patterns or dependencies

```
Example Command: "Search for all files using the githubReportingService"

AI Assistant will:
1. Use search_code to find matches
2. Analyze usage patterns
3. Suggest improvements or identify issues
```

### 5. Repository Management

**Use Case**: Set up new projects or fork repositories

```
Example Command: "Fork the demo repository and create a feature branch"

AI Assistant will:
1. Use fork_repository to create the fork
2. Use create_branch to set up the feature branch
3. Ready for development work
```

## Integration with Existing Reporting System

The GitHub MCP server **complements** your existing reporting API:

| Feature | GitHub MCP Server | Custom Reporting API |
|---------|------------------|---------------------|
| **Create/Update Issues** | ✅ Yes | ❌ No |
| **Manage Labels** | ✅ Yes | ❌ No |
| **Projects v2 Queries** | ❌ No | ✅ Yes |
| **Executive Reports** | ❌ No | ✅ Yes |
| **Blocker Detection** | ❌ No | ✅ Yes |
| **Milestone Analytics** | ❌ No | ✅ Yes |
| **PowerPoint Export** | ❌ No | ✅ Yes |

### Workflow Example

1. **AI creates issue** via GitHub MCP: `create_issue` with `risk:blocker` label
2. **Reporting API detects it**: Next API call includes the new blocker
3. **Dashboard updates**: Blocker appears in the executive report
4. **Export includes it**: PowerPoint export shows the new blocker

## Best Practices

### 1. Use Appropriate Labels
Always use consistent labels that align with your reporting system:
- `risk:blocker` - Critical blockers
- `stage-gate:N` - Stage gate tracking
- `workstream:X` - Workstream categorization
- `review:required` - Items needing review

### 2. Link Related Items
When creating issues or PRs, reference related items:
```
"Create issue for #123 blocker resolution"
```

### 3. Maintain Consistency
Use the same terminology and structure across:
- Issue titles
- PR descriptions
- Labels
- Milestones

### 4. Leverage Search
Before creating new items, search to avoid duplicates:
```
"Search for existing issues about demo environment"
```

### 5. Automate Repetitive Tasks
Use the MCP server for routine operations:
- Creating standard issue templates
- Adding consistent labels
- Updating multiple issues
- Batch operations

## Example Commands

### Create a Blocker Issue
```
"Create a blocker issue titled 'API Rate Limit Exceeded' with label risk:blocker and assign it to the current milestone"
```

### Update Multiple Issues
```
"Add the stage-gate:3 label to all issues in the Demo Preparation milestone"
```

### Create PR with Review
```
"Create a PR for the export improvements and request review from the team"
```

### Search and Analyze
```
"Search for all TODO comments in the TypeScript files and create issues for them"
```

### Batch Label Updates
```
"Find all issues with 'blocked' in the title and add the risk:blocker label"
```

## Troubleshooting

### Server Not Connected
1. Restart Bob/VS Code
2. Check `mcp_settings.json` configuration
3. Verify GitHub token has correct permissions

### Tools Not Available
1. Ensure server is not disabled in settings
2. Check `disabledTools` array is empty
3. Verify token permissions include required scopes

### Authentication Errors
1. Verify token is valid: https://github.com/settings/tokens
2. Check token has required scopes:
   - `repo` - Full repository access
   - `read:org` - Read organization data
   - `read:user` - Read user profile
   - `read:project` - Read project data

## Security Notes

- GitHub token is stored in MCP settings file
- Token has full repository access
- Same token used by reporting API
- Rotate token periodically for security
- Never commit token to version control

## Future Enhancements

Potential improvements to consider:

1. **Automated Blocker Creation**: AI detects potential blockers in code and creates issues
2. **PR Review Automation**: AI reviews PRs and adds comments based on coding standards
3. **Issue Triage**: AI categorizes and labels new issues automatically
4. **Dependency Updates**: AI creates PRs for dependency updates
5. **Documentation Sync**: AI keeps documentation in sync with code changes

## Related Documentation

- [GitHub MCP Server Documentation](https://github.com/modelcontextprotocol/servers/tree/main/src/github)
- [GitHub API Documentation](https://docs.github.com/en/rest)
- [Custom Reporting API](./github-status-reporter-api/README.md)
- [Executive Report Export](./DEPLOYMENT.md)

## Support

For issues or questions:
1. Check GitHub MCP server logs
2. Verify API token permissions
3. Review this documentation
4. Check the official MCP documentation