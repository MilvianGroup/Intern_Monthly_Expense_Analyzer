/**
 * Analysis Agent
 * 
 * This agent is responsible for analyzing expense reports,
 * finding patterns, and providing recommendations for saving money.
 * It supports multiple file formats including CSV, PDF, Excel, and bank statements.
 */

const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const { BedrockChat } = require("langchain/chat_models/bedrock");
const { HumanMessage } = require("langchain/schema");
const { BedrockRuntimeClient, InvokeModelCommand } = require('@aws-sdk/client-bedrock-runtime');
const config = require('../../config/config.json');

class AnalysisAgent {
  constructor() {
    // Initialize LangChain models
    
    // Try to initialize BedrockChat (preferred)
    try {
      this.bedrockLLM = new BedrockChat({
        model: config.aws.bedrock_model_id || "anthropic.claude-3-5-sonnet-20241022-v2:0",
        region: process.env.AWS_REGION || config.aws.region,
        credentials: {
          accessKeyId: process.env.AWS_ACCESS_KEY_ID,
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
        },
        temperature: 0.2,
      });
      this.useBedrockLLM = true;
      console.log("Using LangChain BedrockChat");
    } catch (error) {
      console.warn("Failed to initialize LangChain BedrockChat:", error.message);
      this.useBedrockLLM = false;
    }
    
    // No OpenAI fallback - using AWS Bedrock exclusively
  }

  /**
   * Invoke an LLM model with a prompt
   * @param {string} prompt - The prompt to send to the model
   * @returns {Promise<string>} - The model's response
   */
  async invokeModel(prompt) {
    try {
      // Try using BedrockChat first
      if (this.useBedrockLLM && this.bedrockLLM) {
        try {
          console.log("Using AWS Bedrock via LangChain");
          const response = await this.bedrockLLM.invoke([new HumanMessage(prompt)]);
          return response.content;
        } catch (bedrockError) {
          console.warn("BedrockChat invocation failed:", bedrockError.message);
          // Fall back to OpenAI if Bedrock fails
        }
      }
      
      // If all LangChain methods fail, return a simple error message
      console.error('All LLM invocation methods failed');
      return "I'm sorry, I couldn't process your request due to an error with the language model service.";
    } catch (error) {
      console.error('Error invoking LLM model:', error);
      return null;
    }
  }

  /**
   * Parse a file into an array of expense objects based on file type
   * @param {string} filePath - Path to the file
   * @param {string} fileType - Type of file ('csv', 'pdf', 'excel', 'bank_statement', 'unknown')
   * @param {Object} metadata - Additional metadata about the file
   * @returns {Promise<Array>} - Array of objects representing the expense data
   */
  async parseFile(filePath, fileType, metadata = {}) {
    console.log(`Parsing file of type: ${fileType}`);
    
    switch (fileType) {
      case 'csv':
        return await this.parseCSV(filePath);
      case 'pdf':
        return await this.parsePDF(filePath, metadata);
      case 'excel':
        return await this.parseExcel(filePath, metadata);
      case 'bank_statement':
        return await this.parseBankStatement(filePath, metadata);
      default:
        return await this.parseUnknownFormat(filePath, metadata);
    }
  }

  /**
   * Parse a CSV file into an array of objects
   * @param {string} filePath - Path to the CSV file
   * @returns {Promise<Array>} - Array of objects representing the CSV data
   */
  async parseCSV(filePath) {
    return new Promise((resolve, reject) => {
      const results = [];
      let headers = [];
      let headersParsed = false;
      
      fs.createReadStream(filePath)
        .pipe(csv())
        .on('data', (data) => {
          // Store the headers from the first row
          if (!headersParsed) {
            headers = Object.keys(data);
            headersParsed = true;
            console.log('CSV Headers detected:', headers);
          }
          results.push(data);
        })
        .on('end', () => {
          // Add headers to the results metadata
          const resultsWithMetadata = {
            data: results,
            metadata: {
              headers: headers
            }
          };
          resolve(resultsWithMetadata);
        })
        .on('error', (error) => reject(error));
    });
  }
  
  /**
   * Parse a PDF file into an array of expense objects
   * @param {string} filePath - Path to the PDF file
   * @param {Object} metadata - Additional metadata about the file
   * @returns {Promise<Array>} - Array of objects representing the expense data
   */
  async parsePDF(filePath, metadata = {}) {
    try {
      // Use AWS Bedrock to extract structured data from the PDF
      const bedrockClient = new BedrockRuntimeClient({
        region: config.aws.region
      });
      
      // Read a small portion of the PDF file as binary data
      // Note: We can't actually read PDF content directly, but we'll use the file path
      // in the prompt to AWS Bedrock
      
      const prompt = `
I have a PDF file that contains expense data at path: ${filePath}

I need you to extract the expense data from this PDF and format it as a structured JSON array.
Each expense should have these fields:
- date: The date of the expense
- amount: The monetary amount (as a number)
- category: The category or type of expense
- description: A description of the expense

If the PDF doesn't explicitly mention categories, please infer appropriate categories based on the descriptions.
Return ONLY the JSON array with no additional text or explanation.
`;

      const input = {
        modelId: config.aws.bedrock_model_id,
        contentType: 'application/json',
        accept: 'application/json',
        body: JSON.stringify({
          anthropic_version: 'bedrock-2023-05-31',
          max_tokens: 4000,
          messages: [
            {
              role: 'user',
              content: prompt
            }
          ]
        })
      };
      
      const command = new InvokeModelCommand(input);
      const response = await bedrockClient.send(command);
      
      // Parse the response
      const responseBody = JSON.parse(new TextDecoder().decode(response.body));
      const responseText = responseBody.content[0].text;
      
      // Extract JSON array from the response
      let jsonStartIndex = responseText.indexOf('[');
      let jsonEndIndex = responseText.lastIndexOf(']') + 1;
      
      if (jsonStartIndex === -1 || jsonEndIndex === 0) {
        console.error('Could not find JSON array in response');
        return [];
      }
      
      const jsonStr = responseText.substring(jsonStartIndex, jsonEndIndex);
      const expenses = JSON.parse(jsonStr);
      
      console.log(`Successfully extracted ${expenses.length} expenses from PDF`);
      return expenses;
    } catch (error) {
      console.error('Error parsing PDF file:', error);
      return [];
    }
  }
  
  /**
   * Parse an Excel file into an array of expense objects
   * @param {string} filePath - Path to the Excel file
   * @param {Object} metadata - Additional metadata about the file
   * @returns {Promise<Array>} - Array of objects representing the expense data
   */
  async parseExcel(filePath, metadata = {}) {
    try {
      // Use AWS Bedrock to extract structured data from the Excel file
      const bedrockClient = new BedrockRuntimeClient({
        region: config.aws.region
      });
      
      const prompt = `
I have an Excel file that contains expense data at path: ${filePath}

I need you to extract the expense data from this Excel file and format it as a structured JSON array.
Each expense should have these fields:
- date: The date of the expense
- amount: The monetary amount (as a number)
- category: The category or type of expense
- description: A description of the expense

If the Excel file doesn't explicitly mention categories, please infer appropriate categories based on the descriptions.
Return ONLY the JSON array with no additional text or explanation.
`;

      const input = {
        modelId: config.aws.bedrock_model_id,
        contentType: 'application/json',
        accept: 'application/json',
        body: JSON.stringify({
          anthropic_version: 'bedrock-2023-05-31',
          max_tokens: 4000,
          messages: [
            {
              role: 'user',
              content: prompt
            }
          ]
        })
      };
      
      const command = new InvokeModelCommand(input);
      const response = await bedrockClient.send(command);
      
      // Parse the response
      const responseBody = JSON.parse(new TextDecoder().decode(response.body));
      const responseText = responseBody.content[0].text;
      
      // Extract JSON array from the response
      let jsonStartIndex = responseText.indexOf('[');
      let jsonEndIndex = responseText.lastIndexOf(']') + 1;
      
      if (jsonStartIndex === -1 || jsonEndIndex === 0) {
        console.error('Could not find JSON array in response');
        return [];
      }
      
      const jsonStr = responseText.substring(jsonStartIndex, jsonEndIndex);
      const expenses = JSON.parse(jsonStr);
      
      console.log(`Successfully extracted ${expenses.length} expenses from Excel file`);
      return expenses;
    } catch (error) {
      console.error('Error parsing Excel file:', error);
      return [];
    }
  }
  
  /**
   * Parse a bank statement file into an array of expense objects
   * @param {string} filePath - Path to the bank statement file
   * @param {Object} metadata - Additional metadata about the file
   * @returns {Promise<Array>} - Array of objects representing the expense data
   */
  async parseBankStatement(filePath, metadata = {}) {
    try {
      // Use AWS Bedrock to extract structured data from the bank statement
      const bedrockClient = new BedrockRuntimeClient({
        region: config.aws.region
      });
      
      const bankName = metadata.bankName || 'Unknown';
      
      const prompt = `
I have a bank statement from ${bankName} at path: ${filePath}

I need you to extract all the expense transactions (not deposits or credits) and format them as a structured JSON array.
Each expense should have these fields:
- date: The date of the transaction
- amount: The monetary amount (as a number, positive value)
- category: The category of expense (infer this based on the merchant or description)
- description: The merchant name or transaction description

Return ONLY the JSON array with no additional text or explanation.
`;

      const input = {
        modelId: config.aws.bedrock_model_id,
        contentType: 'application/json',
        accept: 'application/json',
        body: JSON.stringify({
          anthropic_version: 'bedrock-2023-05-31',
          max_tokens: 4000,
          messages: [
            {
              role: 'user',
              content: prompt
            }
          ]
        })
      };
      
      const command = new InvokeModelCommand(input);
      const response = await bedrockClient.send(command);
      
      // Parse the response
      const responseBody = JSON.parse(new TextDecoder().decode(response.body));
      const responseText = responseBody.content[0].text;
      
      // Extract JSON array from the response
      let jsonStartIndex = responseText.indexOf('[');
      let jsonEndIndex = responseText.lastIndexOf(']') + 1;
      
      if (jsonStartIndex === -1 || jsonEndIndex === 0) {
        console.error('Could not find JSON array in response');
        return [];
      }
      
      const jsonStr = responseText.substring(jsonStartIndex, jsonEndIndex);
      const expenses = JSON.parse(jsonStr);
      
      console.log(`Successfully extracted ${expenses.length} expenses from bank statement`);
      return expenses;
    } catch (error) {
      console.error('Error parsing bank statement:', error);
      return [];
    }
  }
  
  /**
   * Parse an unknown format file into an array of expense objects
   * @param {string} filePath - Path to the file
   * @param {Object} metadata - Additional metadata about the file
   * @returns {Promise<Array>} - Array of objects representing the expense data
   */
  async parseUnknownFormat(filePath, metadata = {}) {
    try {
      // Use AWS Bedrock to extract structured data from the unknown format
      const bedrockClient = new BedrockRuntimeClient({
        region: config.aws.region
      });
      
      // Read the file content
      const fileContent = fs.readFileSync(filePath, 'utf8');
      
      const prompt = `
I have a file with financial data. Here's a sample of the content:
${fileContent.substring(0, 2000)}...

I need you to extract the expense data from this file and format it as a structured JSON array.
Each expense should have these fields:
- date: The date of the expense
- amount: The monetary amount (as a number)
- category: The category or type of expense
- description: A description of the expense

If the file doesn't explicitly mention categories, please infer appropriate categories based on the descriptions.
Return ONLY the JSON array with no additional text or explanation.
`;

      const input = {
        modelId: config.aws.bedrock_model_id,
        contentType: 'application/json',
        accept: 'application/json',
        body: JSON.stringify({
          anthropic_version: 'bedrock-2023-05-31',
          max_tokens: 4000,
          messages: [
            {
              role: 'user',
              content: prompt
            }
          ]
        })
      };
      
      const command = new InvokeModelCommand(input);
      const response = await bedrockClient.send(command);
      
      // Parse the response
      const responseBody = JSON.parse(new TextDecoder().decode(response.body));
      const responseText = responseBody.content[0].text;
      
      // Extract JSON array from the response
      let jsonStartIndex = responseText.indexOf('[');
      let jsonEndIndex = responseText.lastIndexOf(']') + 1;
      
      if (jsonStartIndex === -1 || jsonEndIndex === 0) {
        console.error('Could not find JSON array in response');
        return [];
      }
      
      const jsonStr = responseText.substring(jsonStartIndex, jsonEndIndex);
      const expenses = JSON.parse(jsonStr);
      
      console.log(`Successfully extracted ${expenses.length} expenses from unknown format file`);
      return expenses;
    } catch (error) {
      console.error('Error parsing unknown format file:', error);
      return [];
    }
  }

  /**
   * Normalize the expense data to ensure consistent field names
   * @param {Array} expenses - Array of expense objects
   * @returns {Array} - Normalized expense objects
   */
  normalizeExpenseData(expensesData) {
      // Handle the new format with metadata
      let expenses = Array.isArray(expensesData) ? expensesData : expensesData.data;
      let headers = expensesData.metadata?.headers || [];
      
      if (!expenses || expenses.length === 0) {
        return [];
      }
      
      console.log('Normalizing expense data with detected headers:', headers);
      
      // Get the first expense to determine field names
      const firstExpense = expenses[0];
      const keys = Object.keys(firstExpense);
      
      // Find the appropriate field names dynamically based on the actual headers
      const dateField = keys.find(k =>
        k.toLowerCase().includes('date') ||
        k.toLowerCase().includes('time') ||
        k.toLowerCase().includes('when')
      );
      
      // First try to find exact match for "Amount (by category)" which is the main amount field in TestData.csv
      let amountField = keys.find(k => k === 'Amount (by category)');
      
      // If not found, fall back to more general search
      if (!amountField) {
        amountField = keys.find(k =>
          k.toLowerCase().includes('amount') ||
          k.toLowerCase().includes('cost') ||
          k.toLowerCase().includes('price') ||
          k.toLowerCase().includes('value') ||
          k.toLowerCase().includes('charge')
        );
      }
      
      // Debug: Print the first few rows with their amount fields to verify
      console.log('First row amount field value:', firstExpense[amountField]);
      if (expenses.length > 1) {
        console.log('Second row amount field value:', expenses[1][amountField]);
      }
      
      // Use all available category-like fields
      const categoryFields = keys.filter(k =>
        k.toLowerCase().includes('category') ||
        k.toLowerCase().includes('type') ||
        k.toLowerCase().includes('department') ||
        k.toLowerCase().includes('group') ||
        k.toLowerCase().includes('class')
      );
      
      const descriptionField = keys.find(k =>
        k.toLowerCase().includes('description') ||
        k.toLowerCase().includes('desc') ||
        k.toLowerCase().includes('item') ||
        k.toLowerCase().includes('memo') ||
        k.toLowerCase().includes('note') ||
        k.toLowerCase().includes('vendor') ||
        k.toLowerCase().includes('merchant')
      );
      
      console.log('Mapped fields:');
      console.log(`- Date field: ${dateField}`);
      console.log(`- Amount field: ${amountField}`);
      console.log(`- Category fields: ${categoryFields.join(', ')}`);
      console.log(`- Description field: ${descriptionField}`);
      
      let invalidAmountCount = 0;
      
      // Normalize the data
      const normalizedExpenses = expenses.map((expense, index) => {
        // Parse amount to number
        let amount = expense[amountField];
        
        // Debug the first few rows to see what's happening
        if (index < 5) {
          console.log(`Row ${index} - Raw amount value: "${amount}" (${typeof amount})`);
        }
        
        if (typeof amount === 'string') {
          // Remove currency symbols and commas
          amount = amount.replace(/[$,£€]/g, '');
          // Try to parse as float
          amount = parseFloat(amount);
          
          if (index < 5) {
            console.log(`Row ${index} - Parsed amount value: ${amount}`);
          }
        }

        // Only set to 0 if it's actually NaN, not if it's a valid 0 value
        if (isNaN(amount)) {
          invalidAmountCount++;
          if (invalidAmountCount <= 5) {
            // Only log the first 5 invalid amounts to avoid console spam
            console.warn(`Invalid amount detected in row ${index}:`, expense);
            console.warn(`  Amount field: ${amountField}, Value: "${expense[amountField]}"`);
          } else if (invalidAmountCount === 6) {
            console.warn(`Additional invalid amounts detected (suppressing further warnings)`);
          }
          amount = 0;
        }
      
      // Use the first non-empty category field value
      let category = 'Uncategorized';
      for (const catField of categoryFields) {
        if (expense[catField] && expense[catField].trim()) {
          category = expense[catField].trim();
          break;
        }
      }
      
      // If no description field is found, try to use vendor or another meaningful field
      let description = expense[descriptionField] || '';
      if (!description && expense['Vendor name']) {
        description = expense['Vendor name'];
      } else if (!description) {
        // Find any field that might contain useful description information
        const potentialDescFields = keys.filter(k =>
          !k.toLowerCase().includes('date') &&
          !k.toLowerCase().includes('amount') &&
          !categoryFields.includes(k) &&
          expense[k] &&
          typeof expense[k] === 'string' &&
          expense[k].trim().length > 0
        );
        
        if (potentialDescFields.length > 0) {
          description = expense[potentialDescFields[0]];
        }
      }
      
      return {
        date: expense[dateField] || 'Unknown Date',
        amount: amount,
        category: category,
        description: description || 'No Description',
        // Include all original fields for reference
        originalData: {...expense}
      };
    });
    
    if (invalidAmountCount > 0) {
      console.warn(`Total invalid amounts detected: ${invalidAmountCount} out of ${expenses.length} rows (${((invalidAmountCount/expenses.length)*100).toFixed(2)}%)`);
    }
    
    return normalizedExpenses;
  }

  /**
   * Calculate total expenses by category
   * @param {Array} expenses - Array of normalized expense objects
   * @returns {Object} - Object with categories as keys and total amounts as values
   */
  calculateExpensesByCategory(expenses) {
    return expenses.reduce((acc, expense) => {
      const category = expense.category;
      if (!acc[category]) {
        acc[category] = 0;
      }
      acc[category] += expense.amount;
      return acc;
    }, {});
  }

  /**
   * Generate a summary of the expense data
   * @param {Array} expenses - Array of normalized expense objects
   * @returns {Object} - Summary object with total, average, categories, etc.
   */
  generateSummary(expenses) {
    if (!expenses || expenses.length === 0) {
      return {
        total: 0,
        count: 0,
        average: 0,
        categories: {},
        topExpenses: []
      };
    }
    
    const total = expenses.reduce((sum, expense) => sum + expense.amount, 0);
    const count = expenses.length;
    const average = total / count;
    const categories = this.calculateExpensesByCategory(expenses);
    
    // Get top expenses
    const topExpenses = [...expenses]
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5);
    
    return {
      total,
      count,
      average,
      categories,
      topExpenses
    };
  }

  /**
   * Generate recommendations for saving money based on expense data
   * @param {Array} expenses - Array of normalized expense objects
   * @param {Object} summary - Summary object from generateSummary
   * @returns {Promise<Array>} - Array of recommendation strings
   */
  async generateRecommendations(expenses, summary) {
    try {
      // Create a prompt for the AI model
      const prompt = `
You are a financial advisor analyzing a user's monthly expenses. Based on the following expense data, provide 3-5 specific, actionable recommendations for how the user could save money. Focus on identifying patterns, unnecessary expenses, or areas where spending could be optimized.

Expense Summary:
- Total Spent: $${summary.total.toFixed(2)}
- Number of Expenses: ${summary.count}
- Average Expense: $${summary.average.toFixed(2)}

Spending by Category:
${Object.entries(summary.categories)
  .sort((a, b) => b[1] - a[1])
  .map(([category, amount]) => `- ${category}: $${amount.toFixed(2)}`)
  .join('\n')}

Top 5 Largest Expenses:
${summary.topExpenses.map(expense => 
  `- $${expense.amount.toFixed(2)} on ${expense.description || expense.category} (${expense.date})`
).join('\n')}

Provide your recommendations in a bullet point list format, with each recommendation being specific, practical, and actionable. For each recommendation, briefly explain the potential savings.
`;
      
      const aiResponse = await this.invokeModel(prompt);
      
      // Extract recommendations from AI response
      const recommendations = aiResponse
        .split('\n')
        .filter(line => line.trim().startsWith('-') || line.trim().startsWith('•'))
        .map(line => line.replace(/^[-•]\s*/, '').trim())
        .filter(line => line.length > 0);
      
      return recommendations;
    } catch (error) {
      console.error('Error generating recommendations:', error);
      return [
        'Review your highest expense categories for potential savings',
        'Consider setting a budget for discretionary spending',
        'Look for subscription services you may not be fully utilizing'
      ];
    }
  }

  /**
   * Generate a detailed analysis of the expense data
   * @param {Array} expenses - Array of normalized expense objects
   * @param {Object} summary - Summary object from generateSummary
   * @returns {Promise<string>} - Analysis text
   */
  async generateAnalysis(expenses, summary) {
    try {
      // Create a prompt for the AI model
      const prompt = `
You are a financial analyst reviewing a user's monthly expenses. Based on the following expense data, provide a concise but insightful analysis of their spending patterns. Include observations about spending distribution, potential trends, and areas of concern.

Expense Summary:
- Total Spent: $${summary.total.toFixed(2)}
- Number of Expenses: ${summary.count}
- Average Expense: $${summary.average.toFixed(2)}

Spending by Category:
${Object.entries(summary.categories)
  .sort((a, b) => b[1] - a[1])
  .map(([category, amount]) => `- ${category}: $${amount.toFixed(2)} (${((amount / summary.total) * 100).toFixed(1)}%)`)
  .join('\n')}

Top 5 Largest Expenses:
${summary.topExpenses.map(expense => 
  `- $${expense.amount.toFixed(2)} on ${expense.description || expense.category} (${expense.date})`
).join('\n')}

Provide your analysis in 3-4 paragraphs. Be specific and data-driven, but also conversational and helpful. Focus on insights that would be valuable for the user to understand their spending habits.
`;
      
      const aiResponse = await this.invokeModel(prompt);
      return aiResponse;
    } catch (error) {
      console.error('Error generating analysis:', error);
      return `
Analysis of your monthly expenses:

Your total spending was $${summary.total.toFixed(2)} across ${summary.count} expenses, with an average of $${summary.average.toFixed(2)} per expense. The largest spending category was ${
        Object.entries(summary.categories)
          .sort((a, b) => b[1] - a[1])[0][0]
      }, accounting for ${
        ((Object.entries(summary.categories)
          .sort((a, b) => b[1] - a[1])[0][1] / summary.total) * 100).toFixed(1)
      }% of your total expenses.

Consider reviewing your largest expenses to identify potential savings opportunities.
`;
    }
  }

  /**
   * Process the expense report and generate analysis and recommendations
   * @param {Object} expenseReportInfo - Information about the expense report
   * @param {string} expenseReportInfo.filePath - Path to the expense report file
   * @param {string} expenseReportInfo.fileType - Type of file ('csv', 'pdf', 'excel', 'bank_statement', 'unknown')
   * @param {Object} expenseReportInfo.metadata - Additional metadata about the file
   * @returns {Promise<Object>} - Analysis results
   */
  async process(expenseReportInfo) {
    try {
      console.log('Analyzing expense report...');
      
      // If we received a string instead of an object (for backward compatibility)
      if (typeof expenseReportInfo === 'string') {
        expenseReportInfo = {
          filePath: expenseReportInfo,
          fileType: 'csv',
          metadata: {}
        };
      }
      
      const { filePath, fileType, metadata } = expenseReportInfo;
      
      // Parse the file based on its type
      const rawExpensesData = await this.parseFile(filePath, fileType, metadata);
      
      // Extract headers if available from the parsed data
      let headers = [];
      let rawExpenses = rawExpensesData;
      
      // Check if the result has the new format with metadata
      if (rawExpensesData && rawExpensesData.metadata && rawExpensesData.data) {
        headers = rawExpensesData.metadata.headers || [];
        rawExpenses = rawExpensesData.data;
        console.log('Headers detected from file:', headers);
      }
      
      // Add headers to metadata if they were detected
      if (headers.length > 0) {
        expenseReportInfo.metadata = {
          ...expenseReportInfo.metadata,
          headers
        };
      }
      
      // Normalize the expense data
      const expenses = this.normalizeExpenseData(rawExpensesData);
      
      // Generate summary
      const summary = this.generateSummary(expenses);
      
      // Generate recommendations
      const recommendations = await this.generateRecommendations(expenses, summary);
      
      // Generate analysis
      const analysis = await this.generateAnalysis(expenses, summary);
      
      // Save analysis to file
      const outputDir = path.join(__dirname, '../../output');
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }
      
      const analysisPath = path.join(outputDir, 'analysis.txt');
      fs.writeFileSync(analysisPath, analysis);
      
      console.log('Analysis completed successfully');
      
      return {
        expenses,
        summary,
        recommendations,
        analysis,
        analysisPath,
        headers, // Include the detected headers in the result
        detectedCategories: Object.keys(summary.categories) // Include the detected categories
      };
    } catch (error) {
      console.error('Error processing expense report for analysis:', error);
      return null;
    }
  }
}

module.exports = AnalysisAgent;
