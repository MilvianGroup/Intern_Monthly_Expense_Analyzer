/**
 * LangGraph Export for Studio
 * 
 * This file exports the financial workflow graph for use with LangGraph Studio.
 */

const { StateGraph, END } = require('@langchain/langgraph');
const { runFinancialWorkflow } = require('./workflow/financial_workflow');

/**
 * Create and export the financial workflow graph
 */
function createFinancialWorkflowGraph() {
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
      isDemoMode: { value: true } // Default to demo mode for Studio
    }
  });

  // Define nodes in the graph
  workflow.addNode('retrieve_expense', async (state) => {
    console.log('Retrieving expense report...');
    return { expenseReportPath: 'sample_expense_report.csv' };
  });

  workflow.addNode('analyze_expense', async (state) => {
    console.log('Analyzing expense data...');
    return { 
      analysisResults: {
        summary: {
          total: 12345.67,
          count: 42,
          categories: {
            'Office Supplies': 2345.67,
            'Travel': 5000.00,
            'Meals': 3000.00,
            'Other': 2000.00
          }
        },
        recommendations: [
          'Reduce travel expenses by 10%',
          'Consider bulk purchasing office supplies',
          'Review meal expense policy'
        ]
      }
    };
  });

  workflow.addNode('create_visualization', async (state) => {
    console.log('Creating visualizations...');
    return { 
      visualizationResults: {
        chartPath: 'expense_chart.png'
      }
    };
  });

  workflow.addNode('print_summary', async (state) => {
    console.log('Printing summary...');
    return {};
  });

  workflow.addNode('send_email_report', async (state) => {
    console.log('Sending email report...');
    return { emailResult: true };
  });

  // Define edges in the graph
  workflow.addEdge('retrieve_expense', 'analyze_expense');
  workflow.addEdge('analyze_expense', 'create_visualization');
  workflow.addEdge('create_visualization', 'print_summary');
  workflow.addEdge('print_summary', 'send_email_report');
  workflow.addEdge('send_email_report', END);

  // Set the entry point
  workflow.setEntryPoint('retrieve_expense');

  return workflow;
}

// Export the graph
module.exports = {
  financialWorkflow: createFinancialWorkflowGraph()
};
