const fs = require('fs');
const csv = require('csv-parser');

function processCSV(filePath) {
  const results = [];
  const departments = new Set();
  const categories = new Set();
  const vendors = new Set();
  let totalAmount = 0;
  let transactionsWithoutReceipts = 0;
  let headers = [];
  let headersParsed = false;
  
  // Fields to track dynamically
  let amountField = null;
  let departmentField = null;
  let categoryField = null;
  let vendorField = null;
  let receiptField = null;
  
  return new Promise((resolve, reject) => {
    fs.createReadStream(filePath)
      .pipe(csv())
      .on('data', (data) => {
        // Detect headers and map fields on first row
        if (!headersParsed) {
          headers = Object.keys(data);
          console.log('CSV Headers detected:', headers);
          
          // Dynamically identify fields based on header names
          // First try to find exact match for "Amount (by category)" which is the main amount field in TestData.csv
          amountField = headers.find(h => h === 'Amount (by category)');
          
          // If not found, fall back to more general search
          if (!amountField) {
            amountField = headers.find(h =>
              h.toLowerCase().includes('amount') ||
              h.toLowerCase().includes('cost') ||
              h.toLowerCase().includes('price')
            ) || 'Amount (by category)';
          }
          
          departmentField = headers.find(h =>
            h.toLowerCase().includes('department') ||
            h.toLowerCase().includes('dept')
          ) || 'Department Name';
          
          // First try to find exact match for "Category Name" which is the main category field in TestData.csv
          categoryField = headers.find(h => h === 'Category Name');
          
          // If not found, fall back to more general search
          if (!categoryField) {
            categoryField = headers.find(h =>
              h.toLowerCase().includes('category') ||
              h.toLowerCase().includes('type')
            ) || 'Category Name';
          }
          
          vendorField = headers.find(h =>
            h.toLowerCase().includes('vendor') ||
            h.toLowerCase().includes('merchant') ||
            h.toLowerCase().includes('supplier')
          ) || 'Vendor name';
          
          receiptField = headers.find(h =>
            h.toLowerCase().includes('receipt') ||
            h.toLowerCase().includes('invoice')
          ) || 'Has Receipt';
          
          console.log('Mapped fields:');
          console.log(`- Amount field: ${amountField}`);
          console.log(`- Department field: ${departmentField}`);
          console.log(`- Category field: ${categoryField}`);
          console.log(`- Vendor field: ${vendorField}`);
          console.log(`- Receipt field: ${receiptField}`);
          
          headersParsed = true;
        }
        
        // Clean and process the data using dynamically identified fields
        // Parse amount more carefully
        let amount = 0;
        if (data[amountField]) {
          // Debug the first few rows
          if (results.length < 5) {
            console.log(`CSV Row ${results.length} - Raw amount value: "${data[amountField]}" (${typeof data[amountField]})`);
          }
          
          // Remove any currency symbols and commas before parsing
          const cleanedAmount = data[amountField].toString().replace(/[$,£€]/g, '');
          amount = parseFloat(cleanedAmount);
          
          if (results.length < 5) {
            console.log(`CSV Row ${results.length} - Parsed amount value: ${amount}`);
          }
          
          if (isNaN(amount)) {
            console.warn(`Invalid amount detected in CSV row: ${JSON.stringify(data)}`);
            console.warn(`  Amount field: ${amountField}, Value: "${data[amountField]}"`);
            amount = 0;
          }
        }
        
        totalAmount += amount;
        
        // Skip empty departments
        if (departmentField && data[departmentField] && data[departmentField].trim()) {
          departments.add(data[departmentField]);
        }
        
        if (categoryField && data[categoryField] && data[categoryField].trim()) {
          categories.add(data[categoryField]);
        }
        
        if (vendorField && data[vendorField] && data[vendorField].trim()) {
          vendors.add(data[vendorField]);
        }
        
        // Track receipts
        const hasReceipt = receiptField && data[receiptField] &&
          data[receiptField].toString().toUpperCase() === 'TRUE';
        
        if (!hasReceipt) {
          transactionsWithoutReceipts++;
        }
        
        results.push({
          ...data,
          amount: amount,
          hasReceipt: hasReceipt
        });
      })
      .on('end', () => {
        // Calculate statistics
        const monthlySpending = results.reduce((acc, row) => {
          const date = new Date(row['Purchase date']);
          const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
          acc[monthKey] = (acc[monthKey] || 0) + row.amount;
          return acc;
        }, {});

        const vendorSpending = results.reduce((acc, row) => {
          const vendor = row['Vendor name'].trim() || 'Unknown';
          acc[vendor] = (acc[vendor] || 0) + row.amount;
          return acc;
        }, {});

        const stats = {
          totalRows: results.length,
          totalAmount: totalAmount.toFixed(2),
          avgAmount: (totalAmount / results.length).toFixed(2),
          uniqueDepartments: Array.from(departments),
          uniqueCategories: Array.from(categories),
          uniqueVendors: Array.from(vendors),
          transactionsWithoutReceipts,
          receiptComplianceRate: ((results.length - transactionsWithoutReceipts) / results.length * 100).toFixed(1),
          departmentSpending: results.reduce((acc, row) => {
            // Use the dynamically identified department field
            const dept = (departmentField && row[departmentField] && row[departmentField].trim()) || 'Unassigned';
            acc[dept] = (acc[dept] || 0) + row.amount;
            return acc;
          }, {}),
          categorySpending: results.reduce((acc, row) => {
            // Use the dynamically identified category field
            const cat = (categoryField && row[categoryField] && row[categoryField].trim()) || 'Uncategorized';
            acc[cat] = (acc[cat] || 0) + row.amount;
            return acc;
          }, {}),
          monthlySpending,
          vendorSpending,
          // Include detected headers and field mappings
          headers: headers,
          fieldMappings: {
            amountField,
            departmentField,
            categoryField,
            vendorField,
            receiptField
          }
        };
        
        resolve({
          results,
          stats,
          metadata: {
            headers,
            fieldMappings: {
              amountField,
              departmentField,
              categoryField,
              vendorField,
              receiptField
            }
          }
        });
      })
      .on('error', (error) => {
        reject(error);
      });
  });
}

// Example usage
async function main() {
  try {
    const { results, stats } = await processCSV('./TestData.csv');
    console.log('\nFinancial Data Analysis Report');
    console.log('============================');
    console.log(`Total Transactions: ${stats.totalRows}`);
    console.log(`Total Spend: $${stats.totalAmount}`);
    console.log(`Average Transaction Amount: $${stats.avgAmount}`);
    console.log(`Receipt Compliance Rate: ${stats.receiptComplianceRate}%`);
    
    console.log('\nDepartment Analysis:');
    console.log(`Number of Departments: ${stats.uniqueDepartments.length}`);
    Object.entries(stats.departmentSpending)
      .sort((a, b) => b[1] - a[1])
      .forEach(([dept, amount]) => {
        const percentage = ((amount / parseFloat(stats.totalAmount)) * 100).toFixed(1);
        console.log(`  ${dept}: $${amount.toFixed(2)} (${percentage}% of total)`);
      });
    
    console.log('\nTop 5 Spending Categories:');
    Object.entries(stats.categorySpending)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .forEach(([category, amount]) => {
        const percentage = ((amount / parseFloat(stats.totalAmount)) * 100).toFixed(1);
        console.log(`  ${category}: $${amount.toFixed(2)} (${percentage}% of total)`);
      });
    
    console.log('\nTop 5 Vendors by Spend:');
    Object.entries(stats.vendorSpending)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .forEach(([vendor, amount]) => {
        const percentage = ((amount / parseFloat(stats.totalAmount)) * 100).toFixed(1);
        console.log(`  ${vendor}: $${amount.toFixed(2)} (${percentage}% of total)`);
      });
    
    console.log('\nMonthly Spending Trend:');
    Object.entries(stats.monthlySpending)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .forEach(([month, amount]) => {
        console.log(`  ${month}: $${amount.toFixed(2)}`);
      });
  } catch (error) {
    console.error('Error processing CSV:', error);
  }
}

if (require.main === module) {
  main();
}

module.exports = { processCSV };
