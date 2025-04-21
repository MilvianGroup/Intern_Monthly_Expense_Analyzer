/**
 * Expense Report Retriever Agent
 * 
 * This agent is responsible for retrieving expense reports from Google Drive
 * using the Google Drive MCP.
 */

const fs = require('fs');
const path = require('path');
const { BedrockRuntimeClient, InvokeModelCommand } = require('@aws-sdk/client-bedrock-runtime');
const config = require('../../config/config.json');

class ExpenseRetrieverAgent {
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
   * Retrieve the expense report from Google Drive
   * @param {Object} googleDriveMCP - The Google Drive MCP instance
   * @returns {Promise<string|null>} - Path to the downloaded expense report or null if failed
   */
  async retrieveExpenseReport(googleDriveMCP) {
    try {
      console.log('Retrieving expense report from Google Drive...');
      
      // Use the Google Drive MCP to get the expense report
      const expenseReportPath = await googleDriveMCP.getExpenseReport();
      
      if (!expenseReportPath) {
        console.error('Failed to retrieve expense report from Google Drive');
        return null;
      }
      
      console.log(`Expense report retrieved successfully: ${expenseReportPath}`);
      return expenseReportPath;
    } catch (error) {
      console.error('Error retrieving expense report:', error);
      return null;
    }
  }

  /**
   * Validate the expense report CSV file
   * @param {string} filePath - Path to the expense report CSV file
   * @returns {Promise<boolean>} - Whether the file is valid
   */
  async validateExpenseReport(filePath) {
    try {
      if (!fs.existsSync(filePath)) {
        console.error(`File does not exist: ${filePath}`);
        return false;
      }
      
      const fileContent = fs.readFileSync(filePath, 'utf8');
      const lines = fileContent.trim().split('\n');
      
      if (lines.length < 2) {
        console.error('Expense report is empty or has no data rows');
        return false;
      }
      
      const headers = lines[0].split(',');
      
      // Check for required columns
      const requiredColumns = ['date', 'amount', 'category', 'description'];
      const headerLower = headers.map(h => h.toLowerCase());
      
      const missingColumns = requiredColumns.filter(col => 
        !headerLower.some(h => h.includes(col))
      );
      
      if (missingColumns.length > 0) {
        console.error(`Missing required columns: ${missingColumns.join(', ')}`);
        
        // Ask the AI for help in interpreting the columns
        const prompt = `
I have a CSV expense report with the following columns:
${headers.join(', ')}

I need to map these columns to standard fields:
- date: The date of the expense
- amount: The monetary amount spent
- category: The category or type of expense
- description: A description of the expense

Can you help me identify which columns correspond to these standard fields?
`;
        
        const aiResponse = await this.invokeModel(prompt);
        console.log('AI column mapping suggestion:', aiResponse);
      }
      
      return true;
    } catch (error) {
      console.error('Error validating expense report:', error);
      return false;
    }
  }

  /**
   * Process the expense report
   * @param {Object} googleDriveMCP - The Google Drive MCP instance
   * @returns {Promise<string|null>} - Path to the processed expense report or null if failed
   */
  async process(googleDriveMCP) {
    try {
      // Retrieve the expense report
      const expenseReportPath = await this.retrieveExpenseReport(googleDriveMCP);
      
      if (!expenseReportPath) {
        return null;
      }
      
      // Validate the expense report
      const isValid = await this.validateExpenseReport(expenseReportPath);
      
      if (!isValid) {
        console.error('Expense report validation failed');
        return null;
      }
      
      // Return the path to the validated expense report
      return expenseReportPath;
    } catch (error) {
      console.error('Error processing expense report:', error);
      return null;
    }
  }
}

module.exports = ExpenseRetrieverAgent;
