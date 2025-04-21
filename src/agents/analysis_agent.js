/**
 * Analysis Agent
 * 
 * This agent is responsible for analyzing expense reports,
 * finding patterns, and providing recommendations for saving money.
 */

const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const { BedrockRuntimeClient, InvokeModelCommand } = require('@aws-sdk/client-bedrock-runtime');
const config = require('../../config/config.json');

class AnalysisAgent {
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
          max_tokens: 2048,
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
   * Parse a CSV file into an array of objects
   * @param {string} filePath - Path to the CSV file
   * @returns {Promise<Array>} - Array of objects representing the CSV data
   */
  async parseCSV(filePath) {
    return new Promise((resolve, reject) => {
      const results = [];
      
      fs.createReadStream(filePath)
        .pipe(csv())
        .on('data', (data) => results.push(data))
        .on('end', () => resolve(results))
        .on('error', (error) => reject(error));
    });
  }

  /**
   * Normalize the expense data to ensure consistent field names
   * @param {Array} expenses - Array of expense objects
   * @returns {Array} - Normalized expense objects
   */
  normalizeExpenseData(expenses) {
    if (!expenses || expenses.length === 0) {
      return [];
    }
    
    // Get the first expense to determine field names
    const firstExpense = expenses[0];
    const keys = Object.keys(firstExpense);
    
    // Find the appropriate field names
    const dateField = keys.find(k => k.toLowerCase().includes('date'));
    const amountField = keys.find(k => 
      k.toLowerCase().includes('amount') || 
      k.toLowerCase().includes('cost') || 
      k.toLowerCase().includes('price')
    );
    const categoryField = keys.find(k => 
      k.toLowerCase().includes('category') || 
      k.toLowerCase().includes('type')
    );
    const descriptionField = keys.find(k => 
      k.toLowerCase().includes('description') || 
      k.toLowerCase().includes('desc') || 
      k.toLowerCase().includes('item')
    );
    
    // Normalize the data
    return expenses.map(expense => {
      // Parse amount to number
      let amount = expense[amountField];
      if (typeof amount === 'string') {
        // Remove currency symbols and commas
        amount = amount.replace(/[$,£€]/g, '');
        amount = parseFloat(amount);
      }
      
      return {
        date: expense[dateField],
        amount: isNaN(amount) ? 0 : amount,
        category: expense[categoryField] || 'Uncategorized',
        description: expense[descriptionField] || ''
      };
    });
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
   * @param {string} expenseReportPath - Path to the expense report CSV file
   * @returns {Promise<Object>} - Analysis results
   */
  async process(expenseReportPath) {
    try {
      console.log('Analyzing expense report...');
      
      // Parse the CSV file
      const rawExpenses = await this.parseCSV(expenseReportPath);
      
      // Normalize the expense data
      const expenses = this.normalizeExpenseData(rawExpenses);
      
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
        analysisPath
      };
    } catch (error) {
      console.error('Error processing expense report for analysis:', error);
      return null;
    }
  }
}

module.exports = AnalysisAgent;
