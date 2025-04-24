/**
 * Email Reporting Agent
 * 
 * This agent is responsible for sending expense reports and analysis
 * via email using the Gmail MCP.
 */

const fs = require('fs');
const path = require('path');
const { BedrockRuntimeClient, InvokeModelCommand } = require('@aws-sdk/client-bedrock-runtime');
const config = require('../../config/config.json');

class EmailReportingAgent {
  constructor() {
    // Initialize AWS Bedrock client
    this.bedrockClient = new BedrockRuntimeClient({
      region: config.aws.region
    });
    
    this.modelId = config.aws.bedrock_model_id;
  }

  /**
   * Invoke the AWS Bedrock model with a prompt
   * @param {string} prompt - The prompt to send to the model
   * @returns {Promise<string>} - The model's response
   */
  async invokeModel(prompt) {
    try {
      const input = {
        modelId: this.modelId,
        contentType: 'application/json',
        accept: 'application/json',
        body: JSON.stringify({
          anthropic_version: 'bedrock-2023-05-31',
          max_tokens: 1024,
          messages: [
            {
              role: 'user',
              content: prompt
            }
          ]
        })
      };
      
      const command = new InvokeModelCommand(input);
      const response = await this.bedrockClient.send(command);
      
      // Parse the response
      const responseBody = JSON.parse(new TextDecoder().decode(response.body));
      return responseBody.content[0].text;
    } catch (error) {
      console.error('Error invoking AWS Bedrock model:', error);
      return null;
    }
  }

  /**
   * Generate a simple email subject with the expense report filename
   * @param {Object} analysisResults - Results from the Analysis Agent
   * @returns {Promise<string>} - Email subject
   */
  async generateEmailSubject(analysisResults) {
    try {
      // Get the expense report filename
      let expenseFilename = "Monthly Expense Report";
      
      // If we have access to the original expense report path through analysisResults
      if (analysisResults.expenseReportPath) {
        expenseFilename = path.basename(analysisResults.expenseReportPath);
      }
      
      // Create a simple subject with the filename
      return `Expense report for ${expenseFilename}`;
    } catch (error) {
      console.error('Error generating email subject:', error);
      return config.report.subject;
    }
  }

  /**
   * Send the expense report email
   * @param {Object} mcpServer - The MCP server object
   * @param {Object} analysisResults - Results from the Analysis Agent
   * @returns {Promise<boolean>} - Success status
   */
  async sendReport(mcpServer, analysisResults) {
    try {
      console.log('Preparing to send expense report email...');
      
      if (!analysisResults) {
        console.error('No analysis results available for email report');
        return false;
      }
      
      const { recommendations, analysisPath, visualizations } = analysisResults;
      
      // Debug log to see what's in the visualizations object
      console.log('Visualizations object:', JSON.stringify(visualizations, null, 2));
      
      // Generate a personalized email subject
      const subject = await this.generateEmailSubject(analysisResults);
      
      // Check if we're using a local MCP instance or an external one
      if (mcpServer.sendExpenseReport) {
        // Local MCP instance
        console.log('Using local Gmail MCP');
        
        // Prepare attachments and chart info for the email
        const attachments = [];
        let chartInfo = null;
        
        // Always use the PNG chart from the output directory with CID attachment
        const pngChartPath = path.join(__dirname, '../../output/expense_chart.png');
        
        if (fs.existsSync(pngChartPath)) {
          console.log(`Using PNG chart from output directory: ${pngChartPath}`);
          
          // Add as attachment with CID for embedding in HTML
          attachments.push({
            filename: 'expense_chart.png',
            path: pngChartPath,
            cid: 'expense-chart' // Content ID for embedding in HTML
          });
          
          // Store chart info for the email template
          chartInfo = {
            type: 'png',
            path: pngChartPath,
            filename: 'expense_chart.png',
            summary: analysisResults.summary // Include the summary data for the table
          };
          
          console.log(`Chart will be embedded in the email body using CID reference`);
        }
        // Fallback to HTML if PNG is not available
        else if (visualizations && visualizations.chartPath && visualizations.chartPath.endsWith('.html')) {
          console.log(`Adding HTML chart to email: ${visualizations.chartPath}`);
          
          // Store chart info for the email template
          chartInfo = {
            type: 'html',
            path: visualizations.chartPath,
            filename: 'expense_chart.html'
          };
          
          // Don't add HTML chart as attachment since it will be embedded in the email body
          console.log(`HTML chart will be embedded directly in the email body`);
        }
        
        // Local MCP instance
        const result = await mcpServer.sendExpenseReport({
          to: config.user.email,
          subject,
          reportPath: analysisPath,
          expenseReportPath: analysisResults.expenseReportPath, // Pass the original expense report path
          recommendations,
          attachments: attachments,
          chartInfo: chartInfo
        });
        
        if (result) {
          console.log(`Expense report email sent successfully to ${config.user.email}`);
        } else {
          console.error('Failed to send expense report email');
        }
        
        return result;
      } else {
        console.error('Invalid MCP server provided');
        return false;
      }
    } catch (error) {
      console.error('Error sending expense report email:', error);
      return false;
    }
  }

  /**
   * Process and send the expense report
   * @param {Object} mcpServer - The MCP server object
   * @param {Object} analysisResults - Results from the Analysis Agent
   * @returns {Promise<boolean>} - Success status
   */
  async process(mcpServer, analysisResults) {
    try {
      return await this.sendReport(mcpServer, analysisResults);
    } catch (error) {
      console.error('Error processing email report:', error);
      return false;
    }
  }
}

module.exports = EmailReportingAgent;
