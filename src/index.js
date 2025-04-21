/**
 * Monthly Financial Project
 * 
 * Main entry point for the application that orchestrates the workflow using LangGraph:
 * 1. Retrieve expense report from Google Drive or uploaded file
 * 2. Analyze expense data and find patterns
 * 3. Create visualizations
 * 4. Send report via email
 * 
 * This follows the original vision from Arman_PoC.drawio but uses LangGraph
 * for workflow orchestration.
 */

require('dotenv').config();
const path = require('path');
const fs = require('fs');

// Import helpers
const { ensureDirectoryExists } = require('./utils/helpers');

// Import LangGraph workflow
const { runFinancialWorkflow } = require('./workflow/financial_workflow');

// Create necessary directories
ensureDirectoryExists(path.join(__dirname, '../temp'));
ensureDirectoryExists(path.join(__dirname, '../output'));

/**
 * Main workflow function
 */
async function runWorkflow() {
  try {
    // Check if we're in demo/test mode
    const isDemoMode = process.env.DEMO_MODE === 'true' || process.argv.includes('--demo');
    
    // Run the LangGraph workflow
    await runFinancialWorkflow({ isDemoMode });
    
  } catch (error) {
    console.error('Error in workflow:', error);
    process.exit(1);
  }
}

// Run the workflow
if (require.main === module) {
  runWorkflow().catch(error => {
    console.error('Unhandled error in workflow:', error);
    process.exit(1);
  });
}

module.exports = {
  runWorkflow
};
