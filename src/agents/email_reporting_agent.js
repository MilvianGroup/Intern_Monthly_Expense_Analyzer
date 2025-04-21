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
   * Generate a personalized email subject
   * @param {Object} analysisResults - Results from the Analysis Agent
   * @returns {Promise<string>} - Email subject
   */
  async generateEmailSubject(analysisResults) {
    try {
      const { summary } = analysisResults;
      
      if (!summary) {
        return config.report.subject;
      }
      
      // Get the top spending category
      const topCategory = Object.entries(summary.categories)
        .sort((a, b) => b[1] - a[1])[0][0];
      
      // Create a prompt for the AI model
      const prompt = `
Generate a brief, engaging email subject line for a monthly expense report email. 
The total expenses for the month were $${summary.total.toFixed(2)}, and the top spending category was "${topCategory}".
Make it personalized and interesting, but keep it under 60 characters.
Do not use quotes in your response, just provide the subject line text.
`;
      
      const aiResponse = await this.invokeModel(prompt);
      
      // Clean up the response
      const subject = aiResponse
        .trim()
        .replace(/^["']|["']$/g, '') // Remove quotes if present
        .replace(/^Subject:?\s*/i, ''); // Remove "Subject:" prefix if present
      
      return subject || config.report.subject;
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
      
      // Generate a personalized email subject
      const subject = await this.generateEmailSubject(analysisResults);
      
      // Check if we're using a local MCP instance or an external one
      if (mcpServer.sendExpenseReport) {
        // Local MCP instance
        console.log('Using local Gmail MCP');
        
        // Prepare attachments and chart info for the email
        const attachments = [];
        let chartInfo = null;
        
        if (visualizations) {
          // Prioritize HTML chart over PNG
          if (visualizations.chartPath && visualizations.chartPath.endsWith('.html')) {
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
          // Fallback to PNG if HTML is not available
          else if (visualizations.chartPath && visualizations.chartPath.endsWith('.png')) {
            console.log(`Adding PNG chart to email: ${visualizations.chartPath}`);
            
            // Store chart info for the email template
            chartInfo = {
              type: 'png',
              path: visualizations.chartPath,
              filename: 'expense_chart.png'
            };
            
            // Add as attachment with CID for embedding
            attachments.push({
              filename: 'expense_chart.png',
              path: visualizations.chartPath,
              cid: 'expense-chart' // Content ID for embedding in HTML
            });
          }
        }
        
        // Local MCP instance
        const result = await mcpServer.sendExpenseReport({
          to: config.user.email,
          subject,
          reportPath: analysisPath,
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
