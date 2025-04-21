/**
 * Helper Utilities
 * 
 * This file contains helper functions used throughout the application.
 */

const fs = require('fs');
const path = require('path');

/**
 * Ensure a directory exists, creating it if necessary
 * @param {string} dirPath - Path to the directory
 * @returns {boolean} - Whether the directory exists or was created
 */
function ensureDirectoryExists(dirPath) {
  try {
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
      console.log(`Created directory: ${dirPath}`);
    }
    return true;
  } catch (error) {
    console.error(`Error creating directory ${dirPath}:`, error);
    return false;
  }
}

/**
 * Format a date as YYYY-MM-DD
 * @param {Date} date - Date object
 * @returns {string} - Formatted date string
 */
function formatDate(date = new Date()) {
  return date.toISOString().split('T')[0];
}

/**
 * Format a currency amount
 * @param {number} amount - Amount to format
 * @param {string} currency - Currency code (default: USD)
 * @returns {string} - Formatted currency string
 */
function formatCurrency(amount, currency = 'USD') {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency
  }).format(amount);
}

/**
 * Create a sample expense report CSV for testing
 * @param {string} outputPath - Path to save the CSV file
 * @returns {string} - Path to the created file
 */
function createSampleExpenseReport(outputPath) {
  const today = new Date();
  const oneMonthAgo = new Date();
  oneMonthAgo.setMonth(today.getMonth() - 1);
  
  const headers = ['Date', 'Amount', 'Category', 'Description'];
  
  const categories = [
    'Groceries',
    'Dining',
    'Transportation',
    'Entertainment',
    'Housing',
    'Utilities',
    'Healthcare',
    'Shopping',
    'Travel',
    'Education',
    'Personal Care',
    'Gifts',
    'Subscriptions'
  ];
  
  const getRandomDate = () => {
    const start = oneMonthAgo.getTime();
    const end = today.getTime();
    const randomDate = new Date(start + Math.random() * (end - start));
    return formatDate(randomDate);
  };
  
  const getRandomAmount = (min, max) => {
    return (Math.random() * (max - min) + min).toFixed(2);
  };
  
  const getRandomCategory = () => {
    return categories[Math.floor(Math.random() * categories.length)];
  };
  
  const descriptions = {
    'Groceries': ['Supermarket', 'Farmers Market', 'Organic Store', 'Convenience Store'],
    'Dining': ['Restaurant', 'Fast Food', 'Coffee Shop', 'Food Delivery'],
    'Transportation': ['Gas', 'Public Transit', 'Uber/Lyft', 'Car Maintenance'],
    'Entertainment': ['Movies', 'Concert', 'Streaming Service', 'Books'],
    'Housing': ['Rent', 'Mortgage', 'Home Repairs', 'Furniture'],
    'Utilities': ['Electricity', 'Water', 'Internet', 'Phone Bill'],
    'Healthcare': ['Doctor Visit', 'Pharmacy', 'Health Insurance', 'Gym Membership'],
    'Shopping': ['Clothing', 'Electronics', 'Home Goods', 'Online Shopping'],
    'Travel': ['Flight', 'Hotel', 'Car Rental', 'Vacation Activities'],
    'Education': ['Tuition', 'Books', 'Online Course', 'School Supplies'],
    'Personal Care': ['Haircut', 'Spa', 'Cosmetics', 'Toiletries'],
    'Gifts': ['Birthday Gift', 'Holiday Gift', 'Donation', 'Charity'],
    'Subscriptions': ['Netflix', 'Spotify', 'Amazon Prime', 'Software Subscription']
  };
  
  const getRandomDescription = (category) => {
    const options = descriptions[category] || ['Miscellaneous'];
    return options[Math.floor(Math.random() * options.length)];
  };
  
  // Generate 30-50 expense entries
  const numEntries = Math.floor(Math.random() * 21) + 30; // 30-50
  const entries = [];
  
  for (let i = 0; i < numEntries; i++) {
    const category = getRandomCategory();
    const entry = [
      getRandomDate(),
      getRandomAmount(5, 200),
      category,
      getRandomDescription(category)
    ];
    entries.push(entry);
  }
  
  // Add some big expenses
  const bigExpenses = [
    [getRandomDate(), getRandomAmount(500, 1500), 'Housing', 'Rent'],
    [getRandomDate(), getRandomAmount(100, 300), 'Utilities', 'Electricity and Water'],
    [getRandomDate(), getRandomAmount(200, 400), 'Transportation', 'Car Payment']
  ];
  
  entries.push(...bigExpenses);
  
  // Sort by date
  entries.sort((a, b) => new Date(a[0]) - new Date(b[0]));
  
  // Create CSV content
  const csvContent = [
    headers.join(','),
    ...entries.map(entry => entry.join(','))
  ].join('\n');
  
  // Ensure directory exists
  const dir = path.dirname(outputPath);
  ensureDirectoryExists(dir);
  
  // Write to file
  fs.writeFileSync(outputPath, csvContent);
  
  console.log(`Created sample expense report at ${outputPath}`);
  return outputPath;
}

module.exports = {
  ensureDirectoryExists,
  formatDate,
  formatCurrency,
  createSampleExpenseReport
};
