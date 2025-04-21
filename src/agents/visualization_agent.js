/**
 * Visualization Agent
 * 
 * This agent is responsible for creating visualizations of expense data,
 * particularly pie charts showing expense breakdowns by category.
 */

const fs = require('fs');
const path = require('path');
const config = require('../../config/config.json');

class VisualizationAgent {
  constructor() {
    this.colors = [
      '#FF6384', // Red
      '#36A2EB', // Blue
      '#FFCE56', // Yellow
      '#4BC0C0', // Teal
      '#9966FF', // Purple
      '#FF9F40', // Orange
      '#C9CBCF', // Grey
      '#7ED321', // Green
      '#F8E71C', // Bright Yellow
      '#BD10E0', // Magenta
      '#50E3C2', // Mint
      '#4A90E2', // Light Blue
      '#D0021B', // Dark Red
      '#8B572A', // Brown
      '#417505'  // Dark Green
    ];
  }

  /**
   * Create an HTML file with a pie chart using Chart.js
   * @param {Object} categories - Object with categories as keys and amounts as values
   * @param {string} title - Title for the chart
   * @returns {string} - Path to the HTML file
   */
  createPieChartHTML(categories, title = 'Expense Breakdown by Category') {
    // Calculate total for percentages
    const total = Object.values(categories).reduce((sum, amount) => sum + amount, 0);
    
    // Sort categories by amount (descending)
    const sortedCategories = Object.entries(categories)
      .sort((a, b) => b[1] - a[1]);
    
    // Prepare data for Chart.js
    const labels = sortedCategories.map(([category]) => category);
    const data = sortedCategories.map(([, amount]) => amount);
    const backgroundColors = sortedCategories.map((_, index) => 
      this.colors[index % this.colors.length]
    );
    
    // Create HTML content with Chart.js
    const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
  <style>
    body {
      font-family: Arial, sans-serif;
      margin: 0;
      padding: 20px;
      background-color: white;
    }
    .container {
      max-width: 800px;
      margin: 0 auto;
      background-color: white;
      padding: 20px;
      border-radius: 8px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    h1 {
      text-align: center;
      color: #333;
    }
    .chart-container {
      position: relative;
      height: 400px;
      width: 100%;
    }
    .total {
      text-align: center;
      font-size: 18px;
      margin-bottom: 20px;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>${title}</h1>
    <div class="total">Total: $${total.toFixed(2)}</div>
    <div class="chart-container">
      <canvas id="expenseChart"></canvas>
    </div>
  </div>

  <script>
    // Data for the pie chart
    const data = {
      labels: ${JSON.stringify(labels)},
      datasets: [{
        data: ${JSON.stringify(data)},
        backgroundColor: ${JSON.stringify(backgroundColors)},
        hoverOffset: 4
      }]
    };

    // Configuration options
    const config = {
      type: 'pie',
      data: data,
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'right',
            labels: {
              font: {
                size: 14
              }
            }
          },
          tooltip: {
            callbacks: {
              label: function(context) {
                const label = context.label || '';
                const value = context.raw || 0;
                const percentage = ((value / ${total}) * 100).toFixed(1);
                return \`\${label}: $\${value.toFixed(2)} (\${percentage}%)\`;
              }
            }
          }
        }
      }
    };

    // Create the pie chart
    const ctx = document.getElementById('expenseChart').getContext('2d');
    const expenseChart = new Chart(ctx, config);
    
    // Signal when the chart is ready
    window.onload = function() {
      console.log('Chart rendering complete');
    };
  </script>
</body>
</html>
    `;
    
    // Create output directory if it doesn't exist
    const outputDir = path.join(__dirname, '../../output');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    
    // Save HTML file
    const htmlPath = path.join(outputDir, 'expense_chart.html');
    fs.writeFileSync(htmlPath, htmlContent);
    
    return htmlPath;
  }

  /**
   * Capture a screenshot of the HTML chart using puppeteer
   * @param {string} htmlPath - Path to the HTML file
   * @param {string} pngPath - Path to save the PNG screenshot
   * @returns {Promise<string>} - Path to the PNG screenshot
   */
  async captureChartScreenshot(htmlPath, pngPath) {
    try {
      // Import puppeteer dynamically to avoid issues if it's not installed
      let puppeteer;
      try {
        puppeteer = require('puppeteer');
      } catch (err) {
        console.warn('Puppeteer is not installed. Cannot capture screenshot.');
        return null;
      }
      
      console.log('Launching browser to capture chart screenshot...');
      
      // Launch a headless browser with various fallback options
      let browser;
      try {
        // Try with new headless mode
        browser = await puppeteer.launch({
          headless: 'new',
          args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
      } catch (err) {
        console.warn('Failed to launch with new headless mode, trying legacy mode...');
        try {
          // Try with legacy headless mode
          browser = await puppeteer.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
          });
        } catch (err2) {
          console.error('Failed to launch browser:', err2);
          return null;
        }
      }
      
      try {
        // Create a new page
        const page = await browser.newPage();
        
        // Set viewport size
        await page.setViewport({ width: 800, height: 600 });
        
        // Navigate to the HTML file
        await page.goto(`file://${htmlPath}`, {
          waitUntil: 'networkidle0',
          timeout: 30000 // Increase timeout to 30 seconds
        });
        
        // Wait for the chart to render
        try {
          await page.waitForFunction('window.Chart !== undefined', { timeout: 5000 });
          await page.waitForTimeout(1000); // Give chart a moment to render
        } catch (err) {
          console.warn('Chart may not be fully rendered, taking screenshot anyway');
        }
        
        // Take a screenshot
        await page.screenshot({ path: pngPath });
        
        console.log(`Screenshot captured successfully: ${pngPath}`);
        
        return pngPath;
      } catch (err) {
        console.error('Error during page operations:', err);
        return null;
      } finally {
        // Always close the browser
        if (browser) {
          await browser.close();
        }
      }
    } catch (error) {
      console.error('Error capturing chart screenshot:', error);
      return null;
    }
  }

  /**
   * Create a text-based visualization of expense data
   * @param {Object} categories - Object with categories as keys and amounts as values
   * @param {string} title - Title for the chart
   * @returns {string} - Text representation of the data
   */
  createTextVisualization(categories, title = 'Expense Breakdown by Category') {
    // Calculate total for percentages
    const total = Object.values(categories).reduce((sum, amount) => sum + amount, 0);
    
    // Sort categories by amount (descending)
    const sortedCategories = Object.entries(categories)
      .sort((a, b) => b[1] - a[1]);
    
    // Create text visualization
    let visualization = `${title}\n`;
    visualization += `${'='.repeat(title.length)}\n\n`;
    visualization += `Total: $${total.toFixed(2)}\n\n`;
    visualization += `Category Breakdown:\n`;
    visualization += `${'='.repeat(18)}\n\n`;
    
    // Add each category with a simple bar chart
    sortedCategories.forEach(([category, amount]) => {
      const percentage = amount / total;
      const barLength = Math.round(percentage * 50); // Max bar length of 50 characters
      const bar = '#'.repeat(barLength);
      
      visualization += `${category.padEnd(20)} $${amount.toFixed(2).padStart(10)} `;
      visualization += `${(percentage * 100).toFixed(1).padStart(5)}% ${bar}\n`;
    });
    
    return visualization;
  }

  /**
   * Process expense data and create visualizations
   * @param {Object} analysisResults - Results from the Analysis Agent
   * @returns {Promise<Object>} - Visualization results
   */
  async process(analysisResults) {
    try {
      console.log('Creating expense visualizations...');
      
      const { summary } = analysisResults;
      
      if (!summary || !summary.categories || Object.keys(summary.categories).length === 0) {
        console.error('No category data available for visualization');
        return null;
      }
      
      // Create output directory if it doesn't exist
      const outputDir = path.join(__dirname, '../../output');
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }
      
      // Create HTML pie chart
      const htmlPath = this.createPieChartHTML(
        summary.categories,
        'Monthly Expense Breakdown by Category'
      );
      
      console.log(`HTML pie chart created successfully: ${htmlPath}`);
      
      // Create PNG path
      const pngPath = htmlPath.replace('.html', '.png');
      
      try {
        // Try to capture a screenshot using puppeteer
        const screenshotPath = await this.captureChartScreenshot(htmlPath, pngPath);
        
        if (screenshotPath) {
          console.log(`Screenshot captured successfully: ${screenshotPath}`);
          
          // Return both HTML and PNG paths, with HTML as primary
          return {
            chartPath: htmlPath,           // Primary chart (HTML)
            pngChartPath: screenshotPath   // PNG version for fallback
          };
        } else {
          throw new Error('Screenshot capture returned null');
        }
      } catch (error) {
        console.error('Failed to capture chart screenshot:', error);
        console.log('Continuing with HTML chart only');
        
        // Create text visualization as additional fallback
        const textVisualization = this.createTextVisualization(
          summary.categories,
          'Monthly Expense Breakdown by Category'
        );
        
        // Save text visualization to file
        const textPath = path.join(outputDir, 'expense_chart.txt');
        fs.writeFileSync(textPath, textVisualization);
        
        console.log(`Text visualization created as fallback: ${textPath}`);
        
        // Return the HTML path as primary and text path as fallback
        return {
          chartPath: htmlPath,
          fallbackChartPath: textPath
        };
      }
    } catch (error) {
      console.error('Error creating visualizations:', error);
      return null;
    }
  }
}

module.exports = VisualizationAgent;
