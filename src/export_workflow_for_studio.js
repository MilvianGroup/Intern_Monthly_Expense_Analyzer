/**
 * Export Financial Workflow for LangGraph Studio
 * 
 * This script exports the financial workflow to a JSON format
 * that can be loaded into LangGraph Studio for visualization,
 * debugging, and monitoring.
 */

const fs = require('fs');
const path = require('path');
const { runFinancialWorkflow } = require('./workflow/financial_workflow');

/**
 * Convert the workflow to LangGraph Studio compatible format
 * @returns {Object} The workflow in LangGraph Studio format
 */
function convertWorkflowToStudioFormat() {
  // Extract workflow structure from financial_workflow.js
  const workflowStructure = {
    name: "Monthly Financial Project Workflow",
    description: "Workflow for processing monthly financial data",
    nodes: [
      {
        id: "retrieve_expense",
        type: "task",
        name: "Retrieve Expense Report",
        description: "Fetches expense data from Google Drive or uses sample data in demo mode"
      },
      {
        id: "analyze_expense",
        type: "task",
        name: "Analyze Expense Data",
        description: "Processes the expense data to find patterns and generate recommendations"
      },
      {
        id: "create_visualization",
        type: "task",
        name: "Create Visualizations",
        description: "Creates charts and visualizations of the expense data"
      },
      {
        id: "print_summary",
        type: "task",
        name: "Print Summary",
        description: "Displays a summary of the analysis results"
      },
      {
        id: "send_email_report",
        type: "task",
        name: "Send Email Report",
        description: "Sends the analysis results and visualizations via email"
      }
    ],
    edges: [
      {
        source: "retrieve_expense",
        target: "analyze_expense"
      },
      {
        source: "analyze_expense",
        target: "create_visualization"
      },
      {
        source: "create_visualization",
        target: "print_summary"
      },
      {
        source: "print_summary",
        target: "send_email_report"
      }
    ],
    state: {
      expenseReportPath: {
        description: "Path to the retrieved expense report CSV file",
        default: null
      },
      analysisResults: {
        description: "Results of the expense analysis including summary and recommendations",
        default: null
      },
      visualizationResults: {
        description: "Paths to generated visualization files",
        default: null
      },
      emailResult: {
        description: "Status of the email sending operation",
        default: null
      },
      googleDriveMCP: {
        description: "Google Drive MCP instance for file operations",
        default: null
      },
      gmailMCP: {
        description: "Gmail MCP instance for sending emails",
        default: null
      },
      isDemoMode: {
        description: "Flag indicating if the workflow is running in demo mode",
        default: false
      }
    },
    stateUpdates: [
      {
        node: "retrieve_expense",
        updates: ["expenseReportPath"]
      },
      {
        node: "analyze_expense",
        updates: ["analysisResults"]
      },
      {
        node: "create_visualization",
        updates: ["analysisResults", "visualizationResults"]
      },
      {
        node: "send_email_report",
        updates: ["emailResult"]
      }
    ],
    stateInputs: [
      {
        node: "analyze_expense",
        inputs: ["expenseReportPath"]
      },
      {
        node: "create_visualization",
        inputs: ["analysisResults"]
      },
      {
        node: "send_email_report",
        inputs: ["analysisResults", "visualizationResults", "gmailMCP"]
      },
      {
        node: "retrieve_expense",
        inputs: ["googleDriveMCP", "isDemoMode"]
      }
    ],
    entryPoint: "retrieve_expense"
  };

  return workflowStructure;
}

/**
 * Export the workflow to a JSON file
 */
function exportWorkflowToJson() {
  try {
    const workflowJson = convertWorkflowToStudioFormat();
    const outputPath = path.join(__dirname, '../langgraph_studio_workflow.json');
    
    fs.writeFileSync(outputPath, JSON.stringify(workflowJson, null, 2));
    
    console.log(`Workflow exported successfully to: ${outputPath}`);
    console.log('\nTo use with LangGraph Studio:');
    console.log('1. Install LangGraph Studio: npm install -g @langchain/langgraph-studio');
    console.log('2. Start LangGraph Studio: langgraph-studio');
    console.log('3. Import the JSON file in the LangGraph Studio interface');
    
    return outputPath;
  } catch (error) {
    console.error('Error exporting workflow:', error);
    throw error;
  }
}

// Execute if this script is run directly
if (require.main === module) {
  exportWorkflowToJson();
}

module.exports = {
  exportWorkflowToJson
};
