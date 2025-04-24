

# LangGraph Studio Integration Guide

This guide explains how to use LangGraph Studio to visualize, debug, and monitor the Monthly Financial Project workflow.

## What is LangGraph Studio?

LangGraph Studio is a visual interface for LangGraph workflows that allows you to:

- Visualize workflow graphs in real-time
- Debug workflows by inspecting state at each node
- Monitor workflow execution
- Trace and analyze workflow runs
- Export and share workflows

## Prerequisites

Before using LangGraph Studio, ensure you have:

1. Docker installed on your system (required for the LangGraph CLI)
   - You can verify your Docker installation with `docker --version`

2. Node.js installed (version 18 or higher recommended)

## Setup Instructions

### 1. Install and Run LangGraph CLI

The LangGraph CLI provides the local development server that powers LangGraph Studio:

```bash
# Using npx (recommended, no global installation required)
npx @langchain/langgraph-cli dev
```

This will:
- Start a local LangGraph server at http://127.0.0.1:2024
- Automatically open LangGraph Studio in your default browser

### 2. Import the Workflow JSON

1. In the LangGraph Studio interface, you can either:
   - Click "Import" and select the `langgraph_studio_workflow.json` file from this project
   - Or navigate directly to: https://smith.langchain.com/studio/?baseUrl=http://127.0.0.1:2024
   
2. The workflow will be loaded and displayed as a graph

## Using LangGraph Studio

### Visualizing the Workflow

Once imported, you'll see a visual representation of the Monthly Financial Project workflow with:

- Nodes representing each step in the workflow
- Edges showing the flow between steps
- State variables displayed in the sidebar

### Running the Workflow

1. Click the "Run" button to execute the workflow
2. You can provide initial state values if needed
3. Watch as the workflow progresses through each node

### Debugging

- Click on any node to see its inputs and outputs
- Inspect the state at each step of the workflow
- Use the "Step" button to execute the workflow one node at a time

### Tracing

LangGraph Studio provides tracing capabilities to help you understand:

- How long each step takes
- What state changes occur at each step
- Any errors or issues that arise during execution

## Modifying the Workflow

You can modify the workflow directly in LangGraph Studio:

1. Add, remove, or edit nodes
2. Change the connections between nodes
3. Modify state definitions
4. Export the updated workflow as JSON

## Exporting Updated Workflows

If you make changes to the workflow in LangGraph Studio:

1. Click the "Export" button
2. Save the JSON file
3. You can then use this JSON to update your code implementation

## Regenerating the Workflow JSON

If you make changes to the workflow in the code, you can regenerate the JSON file by running:

```bash
node src/export_workflow_for_studio.js
```

This will create an updated `langgraph_studio_workflow.json` file that reflects the current state of the workflow in the code.

## Benefits of Using LangGraph Studio

- **Visual Understanding**: See the entire workflow at a glance
- **Interactive Debugging**: Step through the workflow and inspect state
- **Performance Analysis**: Identify bottlenecks and optimization opportunities
- **Collaboration**: Share the workflow visualization with team members
- **Documentation**: Use the visualization as living documentation

## Additional Resources

- [LangGraph Documentation](https://langchain-ai.github.io/langgraph/)
- [LangGraph Studio Documentation](https://langchain-ai.github.io/langgraph/concepts/langgraph_studio/)
