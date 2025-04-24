# Monthly Financial Project

A comprehensive system that automates the process of retrieving expense reports from Google Drive, analyzing spending patterns, generating visualizations, and sending personalized reports via email. The workflow is orchestrated using LangGraph for a more flexible and maintainable architecture.

## Overview

This project implements an automated workflow with the following components:

1. **Expense Report Retriever Agent**: Connects to Google Drive to fetch expense reports in various formats (CSV, PDF, Excel, bank statements)
2. **Analysis Agent**: Processes expense data to find patterns and generate money-saving recommendations
3. **Visualization Agent**: Creates pie charts showing expense breakdowns by category
4. **Email Reporting Agent**: Sends the analysis and visualizations to the configured email address

The system uses AWS Bedrock's Claude LLM API to power the AI agents for file processing, analysis, and recommendations, and LangGraph for workflow orchestration.

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

Run the application once:

```
npm start
```

For demo mode with sample data:

```
npm start -- --demo
```

### Automatic Monitoring

To automatically run the workflow when new files are added to the Google Drive expense folder:

```
npm run monitor
```

This will check for new files every 15 minutes. To change the interval:

```
npm run monitor:5min  # Check every 5 minutes
```

Or specify a custom interval in minutes:

```
node src/drive_monitor.js 30  # Check every 30 minutes
```

You can also set the interval using the `MONITOR_INTERVAL` environment variable in your `.env` file:

```
MONITOR_INTERVAL=10  # Check every 10 minutes
```

#### Running as a Background Service

The easiest way to set up the monitor as a background service is to use the interactive setup script:

```
npm run monitor:setup
```

This script will:
1. Check if PM2 is installed and install it if needed
2. Ask how often you want to check for new files
3. Configure and start the monitor as a background service
4. Optionally set up the monitor to start automatically on system boot

##### Option 1: Simple Background Process (No PM2 Required)

If you don't want to install PM2 or encounter issues with it, you can use the simple background process option:

```
npm run monitor:background
```

This will:
1. Start the monitor as a detached process that runs in the background
2. Continue running even after you close the terminal
3. Write logs to the `logs` directory

For more frequent checks (every 5 minutes):
```
npm run monitor:background:5min
```

To stop the monitor, you'll need to find and terminate the Node.js process:
- On Windows: Use Task Manager
- On macOS/Linux: Use `ps aux | grep drive_monitor` to find the process ID, then `kill <PID>`

##### Option 2: Using PM2 Process Manager

For more advanced process management, you can use PM2:

1. Install PM2 globally:
   ```
   npm install -g pm2
   ```

2. Start the monitor as a daemon:
   ```
   npm run monitor:daemon
   ```

3. For development with more frequent checks (every 5 minutes):
   ```
   npm run monitor:daemon:dev
   ```

4. Useful PM2 commands:
   ```
   npm run monitor:status  # Check status of the monitor
   npm run monitor:logs    # View logs
   npm run monitor:stop    # Stop the monitor
   ```

5. To make the monitor start automatically on system boot:
   ```
   pm2 startup
   pm2 save
   ```

## Supported File Types

The system can process expense data from multiple file formats:

1. **CSV Files**: Traditional comma-separated value files with columns for date, amount, category, and description
2. **PDF Files**: PDF documents containing expense tables or statements
3. **Excel Files**: Spreadsheets with expense data
4. **Bank Statements**: Financial documents from banks showing account transactions, including:
   - OFX/QFX files (Open Financial Exchange format)
   - Bank-provided PDF statements
   - Exported CSV or Excel files from banking portals

The system uses AWS Bedrock to intelligently extract structured expense data from unstructured documents like PDFs and bank statements.

## Workflow

1. The system retrieves the expense report from Google Drive (or generates sample data in demo mode)
2. The Expense Retriever Agent detects the file type and validates the content
3. The Analysis Agent processes the data based on the file type to identify spending patterns and generate recommendations
4. The Visualization Agent creates a pie chart showing expense breakdown by category
5. The Email Reporting Agent sends a personalized report with analysis, recommendations, and visualizations to the configured email address

## Project Structure

```
monthly-financial-project/
├── config/                 # Configuration files
│   ├── config.json         # Main configuration file
│   ├── ecosystem.config.js # PM2 configuration for background services
│   ├── langgraph/          # LangGraph configuration files
│   └── mermaid/            # Mermaid workflow configuration files
├── credentials/            # API credentials (not in repo)
├── docs/                   # Documentation files
│   ├── workflow_diagram.md # LangGraph workflow visualization
│   ├── GOOGLE_API_SETUP_GUIDE.md
│   ├── LANGGRAPH_STUDIO_GUIDE.md
│   ├── NON_DEMO_MODE_SETUP.md
│   └── Arman_PoC.drawio    # Original project diagram
├── output/                 # Generated reports and visualizations
├── scripts/                # Utility scripts
│   ├── setup-monitor.js    # Interactive setup script for the monitor
│   └── start-monitor.js    # Simple background process script (no PM2)
├── src/
│   ├── agents/             # AI agents for different tasks
│   ├── examples/           # Example code
│   ├── mcp/                # MCP servers for external services
│   ├── utils/              # Helper utilities
│   ├── workflow/           # LangGraph workflow implementation
│   ├── auth_server.js      # Authentication server
│   ├── drive_monitor.js    # Google Drive folder monitoring script
│   ├── index.js            # Main entry point
│   ├── langgraph_export.js # LangGraph export utilities
│   └── mermaid_export.js   # Mermaid export utilities
├── temp/                   # Temporary files
├── .env                    # Environment variables (not in repo)
└── package.json            # Project dependencies
```
