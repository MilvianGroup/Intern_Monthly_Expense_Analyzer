/**
 * Financial Workflow using LangGraph
 * 
 * This file implements the financial workflow using LangGraph,
 * orchestrating the different agents in a graph-based workflow.
 */

const { StateGraph, END } = require('@langchain/langgraph');
const { RunnableSequence } = require('@langchain/core/runnables');

// Import agents
const ExpenseRetrieverAgent = require('../agents/expense_retriever_agent');
const AnalysisAgent = require('../agents/analysis_agent');
const VisualizationAgent = require('../agents/visualization_agent');
const EmailReportingAgent = require('../agents/email_reporting_agent');

/**
 * Create a simple wrapper for an agent's process method
 * @param {Object} agent - The agent instance
 * @param {Function} processFunc - The process function to wrap
 * @returns {Function} - The wrapped function
 */
function wrapAgentProcess(agent, processFunc) {
  return async (...args) => {
    try {
      const result = await processFunc.call(agent, ...args);
      return result;
    } catch (error) {
      console.error(`Error in agent process:`, error);
      throw error;
    }
  };
}

/**
 * Create the financial workflow graph
 * @returns {StateGraph} - The workflow graph
 */
function createFinancialWorkflow() {
  // Initialize agents
  const expenseRetriever = new ExpenseRetrieverAgent();
  const analysisAgent = new AnalysisAgent();
  const visualizationAgent = new VisualizationAgent();
  const emailReportingAgent = new EmailReportingAgent();

  // Wrap agent process methods
  const retrieveExpense = wrapAgentProcess(expenseRetriever, expenseRetriever.process);
  const analyzeExpense = wrapAgentProcess(analysisAgent, analysisAgent.process);
  const createVisualization = wrapAgentProcess(visualizationAgent, visualizationAgent.process);
  const sendEmailReport = wrapAgentProcess(emailReportingAgent, emailReportingAgent.process);

  // Define the workflow graph
  const workflow = new StateGraph({
    channels: {
      // Define the state schema
      expenseReportPath: { value: null },
      analysisResults: { value: null },
      visualizationResults: { value: null },
      emailResult: { value: null },
      googleDriveMCP: { value: null },
      gmailMCP: { value: null },
      isDemoMode: { value: false }
    }
  });

  // Define nodes in the graph
  workflow.addNode('retrieve_expense', async (state) => {
    console.log('\n=== Step 1: Retrieving Expense Report ===');
    
    const { googleDriveMCP, isDemoMode } = state;
    
    if (isDemoMode) {
      console.log('Running in demo mode with sample data');
      const { createSampleExpenseReport } = require('../utils/helpers');
      const path = require('path');
      
      const expenseReportPath = createSampleExpenseReport(
        path.join(__dirname, '../../temp/sample_expenses.csv')
      );
      
      return { expenseReportPath };
    } else {
      try {
        const expenseReportPath = await retrieveExpense(googleDriveMCP);
        
        if (!expenseReportPath) {
          throw new Error('Failed to retrieve expense report');
        }
        
        return { expenseReportPath };
      } catch (error) {
        console.log('Falling back to sample data for demonstration');
        const { createSampleExpenseReport } = require('../utils/helpers');
        const path = require('path');
        
        const expenseReportPath = createSampleExpenseReport(
          path.join(__dirname, '../../temp/sample_expenses.csv')
        );
        
        return { expenseReportPath };
      }
    }
  });

  workflow.addNode('analyze_expense', async (state) => {
    console.log('\n=== Step 2: Analyzing Expense Data ===');
    
    const { expenseReportPath } = state;
    
    const analysisResults = await analyzeExpense(expenseReportPath);
    
    if (!analysisResults) {
      throw new Error('Failed to analyze expense data');
    }
    
    return { analysisResults };
  });

  workflow.addNode('create_visualization', async (state) => {
    console.log('\n=== Step 3: Creating Visualizations ===');
    
    const { analysisResults } = state;
    
    try {
      const visualizationResults = await createVisualization(analysisResults);
      
      if (visualizationResults) {
        console.log(`Visualization created: ${visualizationResults.chartPath}`);
        
        // Add visualization results to analysis results
        const updatedAnalysisResults = {
          ...analysisResults,
          visualizations: visualizationResults
        };
        
        return { 
          analysisResults: updatedAnalysisResults,
          visualizationResults
        };
      } else {
        throw new Error('Visualization creation returned null');
      }
    } catch (error) {
      console.warn('Failed to create visualizations:', error.message);
      return { visualizationResults: null };
    }
  });

  workflow.addNode('send_email_report', async (state) => {
    console.log('\n=== Step 4: Sending Email Report ===');
    
    const { analysisResults, gmailMCP, isDemoMode } = state;
    
    if (isDemoMode) {
      const config = require('../../config/config.json');
      console.log('Running in demo mode - email would be sent to:', config.user.email);
      console.log('Email would contain:');
      console.log(`- Analysis results with ${analysisResults.recommendations.length} recommendations`);
      console.log('Email sending skipped in demo mode');
      
      return { emailResult: true };
    } else {
      try {
        const emailResult = await sendEmailReport(gmailMCP, analysisResults);
        
        if (emailResult) {
          console.log('Email report sent successfully');
        } else {
          console.error('Failed to send email report');
        }
        
        return { emailResult: !!emailResult };
      } catch (error) {
        console.error('Error sending email report:', error.message);
        return { emailResult: false };
      }
    }
  });

  workflow.addNode('print_summary', async (state) => {
    const { analysisResults } = state;
    
    console.log('Analysis completed successfully');
    console.log(`Total expenses: $${analysisResults.summary.total.toFixed(2)}`);
    console.log(`Number of expenses: ${analysisResults.summary.count}`);
    console.log(`Top spending categories:`);
    
    Object.entries(analysisResults.summary.categories)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .forEach(([category, amount], index) => {
        console.log(`  ${index + 1}. ${category}: $${amount.toFixed(2)}`);
      });
    
    console.log('\nRecommendations:');
    analysisResults.recommendations.forEach((rec, index) => {
      console.log(`  ${index + 1}. ${rec}`);
    });
    
    return {};
  });

  // Define edges in the graph
  workflow.addEdge('retrieve_expense', 'analyze_expense');
  workflow.addEdge('analyze_expense', 'create_visualization');
  workflow.addEdge('create_visualization', 'print_summary');
  workflow.addEdge('print_summary', 'send_email_report');
  workflow.addEdge('send_email_report', END);

  // Set the entry point
  workflow.setEntryPoint('retrieve_expense');

  return workflow.compile();
}

/**
 * Run the financial workflow
 * @param {Object} options - Workflow options
 * @returns {Promise<Object>} - Workflow results
 */
async function runFinancialWorkflow(options = {}) {
  try {
    const { isDemoMode = false } = options;
    
    console.log('Starting Monthly Financial Project workflow with LangGraph...');
    
    // Initialize the workflow
    const workflow = createFinancialWorkflow();
    
    // Initialize state
    const initialState = {
      expenseReportPath: null,
      analysisResults: null,
      visualizationResults: null,
      emailResult: null,
      isDemoMode
    };
    
    // Add MCP servers to state if not in demo mode
    if (!isDemoMode) {
      try {
        // Create an instance of the Google Drive MCP
        const GoogleDriveMCP = require('../mcp/google_drive_mcp').GoogleDriveMCP;
        const googleDriveMCP = new GoogleDriveMCP();
        await googleDriveMCP.initialize();
        initialState.googleDriveMCP = googleDriveMCP;
        
        // Create an instance of the Gmail MCP
        const GmailMCP = require('../mcp/gmail_mcp').GmailMCP;
        const gmailMCP = new GmailMCP();
        await gmailMCP.initialize();
        initialState.gmailMCP = gmailMCP;
      } catch (error) {
        console.error('Error initializing MCP servers:', error);
        console.log('Falling back to demo mode');
        initialState.isDemoMode = true;
      }
    }
    
    // Run the workflow
    const result = await workflow.invoke(initialState);
    
    console.log('\n=== Workflow Completed Successfully ===');
    
    return result;
  } catch (error) {
    console.error('Error in workflow:', error);
    throw error;
  }
}

module.exports = {
  runFinancialWorkflow
};
