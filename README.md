# Monthly Financial Project

A comprehensive system that automates the process of retrieving expense reports from Google Drive, analyzing spending patterns, generating visualizations, and sending personalized reports via email. The workflow is orchestrated using LangGraph for a more flexible and maintainable architecture.

## Overview

This project implements an automated workflow with the following components:

1. **Expense Report Retriever Agent**: Connects to Google Drive to fetch expense report CSV files
2. **Analysis Agent**: Processes expense data to find patterns and generate money-saving recommendations
3. **Visualization Agent**: Creates pie charts showing expense breakdowns by category
4. **Email Reporting Agent**: Sends the analysis and visualizations to the configured email address

The system uses AWS Bedrock's Claude LLM API to power the AI agents for analysis and recommendations, and LangGraph for workflow orchestration.

### LangGraph Implementation

The project uses LangGraph to create a graph-based workflow with explicit state management:

- **StateGraph**: Defines the workflow as a directed graph with nodes and edges
- **Nodes**: Represent individual steps in the workflow (retrieve, analyze, visualize, report)
- **Edges**: Define the flow between nodes
- **State Management**: Maintains state between nodes, allowing for data to be passed along the workflow

See the [workflow diagram](docs/workflow_diagram.md) for a visual representation of the LangGraph implementation.

## Prerequisites

- AWS account with Bedrock access
- Google Cloud Platform account with Drive and Gmail API access

## Installation

1. Clone the repository
2. Install dependencies:
   ```
   npm install
   ```
3. Set up environment variables:
   Create a `.env` file in the root directory based on `.env.example`

4. Set up Google API credentials:
   - Create a project in the Google Cloud Console
   - Enable the Google Drive API and Gmail API
   - Create a service account with appropriate permissions
   - Download the service account key as JSON
   - Save the key as `credentials/google_credentials.json`

## Configuration

### Email Recipient Configuration

You can change the email recipient in one of two ways:

1. **Primary Method**: Edit the `config/config.json` file:
   ```json
   "user": {
     "email": "your-email@example.com",
     "name": "Your Name"
   }
   ```

2. **Alternative Method**: Set the `EMAIL_RECIPIENT` environment variable in your `.env` file:
   ```
   EMAIL_RECIPIENT=your-email@example.com
   ```

The environment variable will override the setting in the config file if both are present.

## Usage

Run the application:

```
npm start
```

For demo mode with sample data:

```
npm start -- --demo
```

## Workflow

1. The system retrieves the expense report CSV from Google Drive (or generates sample data in demo mode)
2. The Analysis Agent processes the data to identify spending patterns and generate recommendations
3. The Visualization Agent creates a pie chart showing expense breakdown by category
4. The Email Reporting Agent sends a personalized report with analysis, recommendations, and visualizations to the configured email address

## Project Structure

```
monthly-financial-project/
├── config/                 # Configuration files
├── credentials/            # API credentials (not in repo)
├── docs/                   # Documentation files
│   └── workflow_diagram.md # LangGraph workflow visualization
├── output/                 # Generated reports and visualizations
├── src/
│   ├── agents/             # AI agents for different tasks
│   ├── mcp/                # MCP servers for external services
│   ├── utils/              # Helper utilities
│   ├── workflow/           # LangGraph workflow implementation
│   └── index.js            # Main entry point
├── temp/                   # Temporary files
├── .env                    # Environment variables (not in repo)
└── package.json            # Project dependencies
```
