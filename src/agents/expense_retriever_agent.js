/**
 * Expense Report Retriever Agent
 * 
 * This agent is responsible for retrieving expense reports from Google Drive
 * using the Google Drive MCP. It supports multiple file formats including CSV,
 * PDF, and bank statements.
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
   * Detect the file type based on extension and content
   * @param {string} filePath - Path to the file
   * @returns {Promise<string>} - Detected file type ('csv', 'pdf', 'bank_statement', 'unknown')
   */
  async detectFileType(filePath) {
    try {
      if (!fs.existsSync(filePath)) {
        console.error(`File does not exist: ${filePath}`);
        return 'unknown';
      }
      
      // Check file extension
      const extension = path.extname(filePath).toLowerCase();
      
      if (extension === '.csv') {
        return 'csv';
      } else if (extension === '.pdf') {
        return 'pdf';
      } else if (extension === '.xlsx' || extension === '.xls') {
        return 'excel';
      } else if (extension === '.ofx' || extension === '.qfx') {
        return 'bank_statement';
      }
      
      // If extension doesn't clearly indicate type, try to analyze content
      const fileContent = fs.readFileSync(filePath, 'utf8');
      
      // Check if it looks like CSV
      if (fileContent.includes(',') && fileContent.includes('\n')) {
        const lines = fileContent.trim().split('\n');
        if (lines.length > 1) {
          return 'csv';
        }
      }
      
      // If we can't determine the type, use AI to help identify it
      const prompt = `
I have a file that contains financial data. Here's a sample of the content:
${fileContent.substring(0, 500)}...

Based on this content, what type of financial document is this? 
Options: CSV file, PDF statement, Excel spreadsheet, Bank statement (OFX/QFX), or Other.
If it's a bank statement, can you identify which bank it might be from?
`;
      
      const aiResponse = await this.invokeModel(prompt);
      console.log('AI file type detection:', aiResponse);
      
      // Default to unknown if we can't determine
      return 'unknown';
    } catch (error) {
      console.error('Error detecting file type:', error);
      return 'unknown';
    }
  }

  /**
   * Validate the expense report file
   * @param {string} filePath - Path to the expense report file
   * @returns {Promise<{isValid: boolean, fileType: string, metadata: Object}>} - Validation result
   */
  async validateExpenseReport(filePath) {
    try {
      if (!fs.existsSync(filePath)) {
        console.error(`File does not exist: ${filePath}`);
        return { isValid: false, fileType: 'unknown', metadata: {} };
      }
      
      // Detect file type
      const fileType = await this.detectFileType(filePath);
      console.log(`Detected file type: ${fileType}`);
      
      // Validate based on file type
      if (fileType === 'csv') {
        return await this.validateCSV(filePath);
      } else if (fileType === 'pdf') {
        return await this.validatePDF(filePath);
      } else if (fileType === 'excel') {
        return await this.validateExcel(filePath);
      } else if (fileType === 'bank_statement') {
        return await this.validateBankStatement(filePath);
      } else {
        // For unknown file types, use AI to try to understand the structure
        return await this.validateUnknownFormat(filePath);
      }
    } catch (error) {
      console.error('Error validating expense report:', error);
      return { isValid: false, fileType: 'unknown', metadata: {} };
    }
  }
  
  /**
   * Validate a CSV expense report file
   * @param {string} filePath - Path to the CSV file
   * @returns {Promise<{isValid: boolean, fileType: string, metadata: Object}>} - Validation result
   */
  async validateCSV(filePath) {
    try {
      const fileContent = fs.readFileSync(filePath, 'utf8');
      const lines = fileContent.trim().split('\n');
      
      if (lines.length < 2) {
        console.error('CSV file is empty or has no data rows');
        return { isValid: false, fileType: 'csv', metadata: {} };
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
        
        return { 
          isValid: true, // We'll consider it valid and let the AI help with mapping
          fileType: 'csv', 
          metadata: { 
            headers,
            columnMapping: aiResponse,
            rowCount: lines.length - 1
          } 
        };
      }
      
      return { 
        isValid: true, 
        fileType: 'csv', 
        metadata: { 
          headers,
          rowCount: lines.length - 1
        } 
      };
    } catch (error) {
      console.error('Error validating CSV file:', error);
      return { isValid: false, fileType: 'csv', metadata: {} };
    }
  }
  
  /**
   * Validate a PDF expense report file
   * @param {string} filePath - Path to the PDF file
   * @returns {Promise<{isValid: boolean, fileType: string, metadata: Object}>} - Validation result
   */
  async validatePDF(filePath) {
    try {
      // For PDF files, we'll use AWS Bedrock to extract and understand the content
      const prompt = `
I have a PDF file that contains expense data. I need you to:
1. Extract the expense data from this PDF
2. Identify if it contains the necessary information: dates, amounts, categories, and descriptions of expenses
3. Tell me if this PDF appears to be a valid expense report or statement

The file path is: ${filePath}
`;
      
      const aiResponse = await this.invokeModel(prompt);
      console.log('AI PDF validation:', aiResponse);
      
      // Determine if the PDF is valid based on AI response
      const isValid = !aiResponse.toLowerCase().includes('not valid') && 
                     !aiResponse.toLowerCase().includes('cannot extract') &&
                     !aiResponse.toLowerCase().includes('unable to process');
      
      return { 
        isValid, 
        fileType: 'pdf', 
        metadata: { 
          aiAnalysis: aiResponse
        } 
      };
    } catch (error) {
      console.error('Error validating PDF file:', error);
      return { isValid: false, fileType: 'pdf', metadata: {} };
    }
  }
  
  /**
   * Validate an Excel expense report file
   * @param {string} filePath - Path to the Excel file
   * @returns {Promise<{isValid: boolean, fileType: string, metadata: Object}>} - Validation result
   */
  async validateExcel(filePath) {
    try {
      // For Excel files, we'll use AWS Bedrock to understand the structure
      const prompt = `
I have an Excel file that contains expense data. I need you to:
1. Analyze if this Excel file contains expense data
2. Identify if it has the necessary columns or data: dates, amounts, categories, and descriptions of expenses
3. Tell me if this appears to be a valid expense report

The file path is: ${filePath}
`;
      
      const aiResponse = await this.invokeModel(prompt);
      console.log('AI Excel validation:', aiResponse);
      
      // Determine if the Excel file is valid based on AI response
      const isValid = !aiResponse.toLowerCase().includes('not valid') && 
                     !aiResponse.toLowerCase().includes('cannot analyze') &&
                     !aiResponse.toLowerCase().includes('unable to process');
      
      return { 
        isValid, 
        fileType: 'excel', 
        metadata: { 
          aiAnalysis: aiResponse
        } 
      };
    } catch (error) {
      console.error('Error validating Excel file:', error);
      return { isValid: false, fileType: 'excel', metadata: {} };
    }
  }
  
  /**
   * Validate a bank statement file
   * @param {string} filePath - Path to the bank statement file
   * @returns {Promise<{isValid: boolean, fileType: string, metadata: Object}>} - Validation result
   */
  async validateBankStatement(filePath) {
    try {
      // For bank statements, we'll use AWS Bedrock to extract and understand the content
      const prompt = `
I have a bank statement file that contains transaction data. I need you to:
1. Identify what bank this statement is from
2. Extract transaction data including dates, amounts, and descriptions
3. Tell me if this appears to be a valid bank statement with expense information

The file path is: ${filePath}
`;
      
      const aiResponse = await this.invokeModel(prompt);
      console.log('AI bank statement validation:', aiResponse);
      
      // Determine if the bank statement is valid based on AI response
      const isValid = !aiResponse.toLowerCase().includes('not valid') && 
                     !aiResponse.toLowerCase().includes('cannot extract') &&
                     !aiResponse.toLowerCase().includes('unable to process');
      
      // Try to extract bank name from AI response
      let bankName = 'Unknown';
      if (aiResponse.toLowerCase().includes('bank of america')) {
        bankName = 'Bank of America';
      } else if (aiResponse.toLowerCase().includes('chase')) {
        bankName = 'Chase';
      } else if (aiResponse.toLowerCase().includes('wells fargo')) {
        bankName = 'Wells Fargo';
      } else if (aiResponse.toLowerCase().includes('citi')) {
        bankName = 'Citibank';
      }
      
      return { 
        isValid, 
        fileType: 'bank_statement', 
        metadata: { 
          bankName,
          aiAnalysis: aiResponse
        } 
      };
    } catch (error) {
      console.error('Error validating bank statement file:', error);
      return { isValid: false, fileType: 'bank_statement', metadata: {} };
    }
  }
  
  /**
   * Validate an unknown format file
   * @param {string} filePath - Path to the file
   * @returns {Promise<{isValid: boolean, fileType: string, metadata: Object}>} - Validation result
   */
  async validateUnknownFormat(filePath) {
    try {
      // For unknown formats, we'll use AWS Bedrock to try to understand the content
      const fileContent = fs.readFileSync(filePath, 'utf8');
      
      const prompt = `
I have a file with financial data but I'm not sure of its format. Here's a sample of the content:
${fileContent.substring(0, 1000)}...

I need you to:
1. Identify what type of financial document this is
2. Determine if it contains expense data with dates, amounts, categories, and descriptions
3. Tell me if this can be processed as an expense report

The file path is: ${filePath}
`;
      
      const aiResponse = await this.invokeModel(prompt);
      console.log('AI unknown format validation:', aiResponse);
      
      // Determine if the file is valid based on AI response
      const isValid = !aiResponse.toLowerCase().includes('not valid') && 
                     !aiResponse.toLowerCase().includes('cannot process') &&
                     !aiResponse.toLowerCase().includes('unable to process');
      
      return { 
        isValid, 
        fileType: 'unknown', 
        metadata: { 
          aiAnalysis: aiResponse
        } 
      };
    } catch (error) {
      console.error('Error validating unknown format file:', error);
      return { isValid: false, fileType: 'unknown', metadata: {} };
    }
  }

  /**
   * Process the expense report
   * @param {Object} googleDriveMCP - The Google Drive MCP instance
   * @returns {Promise<{filePath: string, fileType: string, metadata: Object}|null>} - Processed expense report info or null if failed
   */
  async process(googleDriveMCP) {
    try {
      // Retrieve the expense report
      const expenseReportPath = await this.retrieveExpenseReport(googleDriveMCP);
      
      if (!expenseReportPath) {
        return null;
      }
      
      // Validate the expense report
      const validationResult = await this.validateExpenseReport(expenseReportPath);
      
      if (!validationResult.isValid) {
        console.error('Expense report validation failed');
        return null;
      }
      
      console.log(`Successfully processed expense report of type: ${validationResult.fileType}`);
      
      // Return the path to the validated expense report along with metadata
      return {
        filePath: expenseReportPath,
        fileType: validationResult.fileType,
        metadata: validationResult.metadata
      };
    } catch (error) {
      console.error('Error processing expense report:', error);
      return null;
    }
  }
}

module.exports = ExpenseRetrieverAgent;
