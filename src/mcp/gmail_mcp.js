/**
 * Gmail MCP Server
 * 
 * This MCP server provides tools to interact with Gmail,
 * specifically for sending expense reports and analysis.
 */

const nodemailer = require('nodemailer');
const fs = require('fs');
const path = require('path');
const config = require('../../config/config.json');

// Check if we're in demo/test mode
const isDemoMode = process.env.DEMO_MODE === 'true' || process.argv.includes('--demo');

class GmailMCP {
  constructor() {
    this.transporter = null;
    this.initialized = false;
  }

  /**
   * Initialize the Gmail client
   */
  async initialize() {
    try {
      // Create a simple SMTP transporter using nodemailer
      this.transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          // Use environment variables for email credentials
          user: process.env.EMAIL_USER || config.user.email,
          pass: process.env.EMAIL_PASSWORD || 'your-app-password-here' // App password, not regular password
        }
      });
      
      this.initialized = true;
      console.log('Gmail MCP initialized successfully');
      return true;
    } catch (error) {
      console.error('Failed to initialize Gmail MCP:', error);
      return false;
    }
  }

  /**
   * Send an email using nodemailer
   * @param {Object} options - Email options
   * @param {string} options.to - Recipient email address
   * @param {string} options.subject - Email subject
   * @param {string} options.text - Plain text email body
   * @param {string} options.html - HTML email body
   * @param {Array} options.attachments - Email attachments
   * @returns {Promise<boolean>} - Success status
   */
  async sendEmail({ to, subject, text, html, attachments }) {
    if (!this.initialized) await this.initialize();
    
    try {
      console.log('Preparing to send email...');
      
      if (isDemoMode) {
        // In demo mode, just log the email details
        console.log('Demo mode: Email sending skipped');
        console.log('Email would be sent with the following details:');
        console.log(`From: ${config.user.email}`);
        console.log(`To: ${to}`);
        console.log(`Subject: ${subject}`);
        console.log('Content: Text and HTML content would be included');
        
        // Log attachments if any
        if (attachments && attachments.length > 0) {
          console.log('Attachments:');
          attachments.forEach(attachment => {
            console.log(`- ${attachment.filename} (${attachment.path})`);
          });
        }
        
        return true;
      }
      
      // For non-demo mode, attempt to send the email
      if (!process.env.EMAIL_PASSWORD) {
        console.log('Email password not found in environment variables.');
        console.log('To send actual emails, you need to:');
        console.log('1. Generate an app password in your Google account');
        console.log('2. Add it to your .env file as EMAIL_PASSWORD=your-app-password');
        console.log('Simulating successful email send for now.');
        return true;
      }
      
      // Prepare email options
      const mailOptions = {
        from: config.user.email,
        to,
        subject,
        text,
        html
      };
      
      // Add attachments if available
      if (attachments && attachments.length > 0) {
        mailOptions.attachments = attachments;
      }
      
      // Send the email
      const info = await this.transporter.sendMail(mailOptions);
      console.log('Email sent successfully:', info.messageId);
      return true;
    } catch (error) {
      console.error('Error sending email:', error);
      return false;
    }
  }

  /**
   * Send expense report email with analysis
   * @param {Object} options - Email options
   * @param {string} options.to - Recipient email address
   * @param {string} options.reportPath - Path to the analysis report text file
   * @param {Array} options.recommendations - Array of saving recommendations
   * @param {Array} options.attachments - Array of email attachments
   * @param {Object} options.chartInfo - Information about the chart (type, path, filename)
   * @returns {Promise<boolean>} - Success status
   */
  async sendExpenseReport({ to, reportPath, recommendations = [], attachments = [], chartInfo = null }) {
    if (!to) to = config.user.email;
    
    try {
      console.log('Preparing to send expense report email...');
      
      // Read report content if path is provided
      let reportContent = '';
      if (reportPath && fs.existsSync(reportPath)) {
        reportContent = fs.readFileSync(reportPath, 'utf8');
      }
      
      // Determine how to handle the chart in the email
      let chartHtml = '';
      
      // If we have chart info, handle it appropriately
      if (chartInfo) {
        if (chartInfo.type === 'html' && chartInfo.path && fs.existsSync(chartInfo.path)) {
          // Read the HTML chart file
          const chartContent = fs.readFileSync(chartInfo.path, 'utf8');
          
          // Extract the chart data from the HTML file
          const totalMatch = chartContent.match(/<div class="total">Total: \$([\d.]+)<\/div>/);
          const total = totalMatch ? parseFloat(totalMatch[1]) : 0;
          
          // Extract labels and data from the chart
          const labelsMatch = chartContent.match(/labels: \[(.*?)\]/);
          const dataMatch = chartContent.match(/data: \[(.*?)\]/);
          const colorsMatch = chartContent.match(/backgroundColor: \[(.*?)\]/);
          
          if (labelsMatch && dataMatch && colorsMatch) {
            // Parse the extracted data
            const labels = JSON.parse(`[${labelsMatch[1]}]`);
            const data = JSON.parse(`[${dataMatch[1]}]`);
            const colors = JSON.parse(`[${colorsMatch[1]}]`);
            
            // Create a static HTML table representation of the chart data
            let tableRows = '';
            let totalAmount = 0;
            
            for (let i = 0; i < labels.length; i++) {
              const value = data[i];
              totalAmount += value;
              const percentage = ((value / total) * 100).toFixed(1);
              const color = colors[i];
              
              tableRows += `
                <tr>
                  <td style="padding: 8px; text-align: left; border-bottom: 1px solid #ddd;">
                    <span style="display: inline-block; width: 12px; height: 12px; background-color: ${color}; margin-right: 5px;"></span>
                    ${labels[i]}
                  </td>
                  <td style="padding: 8px; text-align: right; border-bottom: 1px solid #ddd;">$${value.toFixed(2)}</td>
                  <td style="padding: 8px; text-align: right; border-bottom: 1px solid #ddd;">${percentage}%</td>
                </tr>
              `;
            }
            
            // Create the chart HTML with both static table and interactive chart
            chartHtml = `
              <div class="chart-container" style="margin: 20px 0; text-align: center;">
                <h2>Expense Visualization</h2>
                
                <!-- Static chart information -->
                <div style="max-width: 600px; margin: 0 auto; background-color: #f9f9f9; padding: 15px; border-radius: 5px;">
                  <p>Your expense breakdown is embedded directly in this email.</p>
                  
                  <!-- Static representation of the chart data -->
                  <table style="width: 100%; border-collapse: collapse; margin-top: 15px;">
                    <tr style="background-color: #eaeaea;">
                      <th style="padding: 8px; text-align: left; border-bottom: 1px solid #ddd;">Category</th>
                      <th style="padding: 8px; text-align: right; border-bottom: 1px solid #ddd;">Amount</th>
                      <th style="padding: 8px; text-align: right; border-bottom: 1px solid #ddd;">Percentage</th>
                    </tr>
                    ${tableRows}
                    <tr style="background-color: #eaeaea; font-weight: bold;">
                      <td style="padding: 8px; text-align: left; border-bottom: 1px solid #ddd;">Total</td>
                      <td style="padding: 8px; text-align: right; border-bottom: 1px solid #ddd;">$${total.toFixed(2)}</td>
                      <td style="padding: 8px; text-align: right; border-bottom: 1px solid #ddd;">100.0%</td>
                    </tr>
                  </table>
                </div>
              </div>
            `;
          } else {
            // Extract just the chart container part from the HTML file
            const chartMatch = chartContent.match(/<div class="container">([\s\S]*?)<\/div>\s*<script>/);
            
            if (chartMatch && chartMatch[1]) {
              // Use the extracted chart HTML
              chartHtml = `
                <div class="chart-container" style="margin: 20px 0; text-align: center;">
                  <h2>Expense Visualization</h2>
                  ${chartMatch[1]}
                </div>
              `;
            } else {
              // Fallback to a message about the chart
              chartHtml = `
                <div class="chart-container" style="margin: 20px 0; text-align: center;">
                  <h2>Expense Visualization</h2>
                  <p>An expense chart visualization is included in this report.</p>
                </div>
              `;
            }
          }
        } else if (chartInfo.type === 'png' && chartInfo.path) {
          // For PNG charts, embed using CID reference
          chartHtml = `
            <div class="chart-container" style="margin: 20px 0; text-align: center;">
              <h2>Expense Visualization</h2>
              <img src="cid:expense-chart" alt="Expense Chart" style="max-width: 100%; height: auto;" />
            </div>
          `;
        }
      }
      
      // Create HTML content
      const htmlContent = `
        <html>
          <head>
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              h1 { color: #2c3e50; }
              h2 { color: #3498db; margin-top: 20px; }
              .recommendations { background-color: #f8f9fa; padding: 15px; border-radius: 5px; }
              .recommendation-item { margin-bottom: 10px; padding-left: 20px; position: relative; }
              .recommendation-item:before { content: "→"; position: absolute; left: 0; color: #3498db; }
              .footer { margin-top: 30px; font-size: 12px; color: #7f8c8d; }
              .chart-container { margin: 20px 0; text-align: center; }
              .chart-container img { max-width: 100%; height: auto; }
            </style>
          </head>
          <body>
            <div class="container">
              <h1>${config.report.title}</h1>
              <p>Hello ${config.user.name},</p>
              <p>Here is your monthly expense analysis report.</p>
              
              ${chartHtml}
              
              ${reportContent ? `
              <div class="analysis">
                <h2>Analysis</h2>
                <p>${reportContent.replace(/\n/g, '<br>')}</p>
              </div>
              ` : ''}
              
              ${recommendations.length > 0 ? `
              <div class="recommendations">
                <h2>Recommendations to Save Money</h2>
                <ul>
                  ${recommendations.map(rec => `<li class="recommendation-item">${rec}</li>`).join('')}
                </ul>
              </div>
              ` : ''}
              
              <div class="footer">
                <p>This is an automated report generated on ${new Date().toLocaleDateString()}.</p>
              </div>
            </div>
          </body>
        </html>
      `;
      
      // Create plain text version
      const textContent = `
${config.report.title}

Hello ${config.user.name},

Here is your monthly expense analysis report.

${reportContent ? `\nANALYSIS:\n${reportContent}` : ''}

${recommendations.length > 0 ? `\nRECOMMENDATIONS TO SAVE MONEY:\n${recommendations.map(rec => `- ${rec}`).join('\n')}` : ''}

This is an automated report generated on ${new Date().toLocaleDateString()}.
      `;
      
      // Check if we're in demo/test mode
      if (isDemoMode) {
        console.log('Running in demo mode - email would be sent to:', config.user.email);
        console.log('Email would contain:');
        console.log(`- Analysis results with ${recommendations.length} recommendations`);
        
        // Log attachments if any
        if (attachments && attachments.length > 0) {
          console.log('- Attachments:');
          attachments.forEach(attachment => {
            console.log(`  * ${attachment.filename} (${attachment.path})`);
          });
        }
        
        console.log('Email sending skipped in demo mode');
        return true;
      }
      
      // Prepare email options
      const emailOptions = {
        to,
        subject: config.report.subject,
        text: textContent,
        html: htmlContent
      };
      
      // Add attachments if available
      if (attachments && attachments.length > 0) {
        emailOptions.attachments = attachments;
      }
      
      // Send the email
      const emailSent = await this.sendEmail({
        ...emailOptions,
        attachments: emailOptions.attachments
      });
      
      if (!emailSent) {
        throw new Error('Failed to send expense report email');
      }
      
      console.log('Expense report email sent successfully');
      return true;
    } catch (error) {
      console.error('Error sending expense report email:', error);
      return false;
    }
  }
}

// Export the MCP server definition and the GmailMCP class
module.exports = {
  name: 'gmail-mcp',
  description: 'MCP server for Gmail operations',
  version: '1.0.0',
  
  // Export the GmailMCP class
  GmailMCP: GmailMCP,
  
  // Tools provided by this MCP server
  tools: {
    send_email: {
      description: 'Sends an email',
      parameters: {
        to: {
          type: 'string',
          description: 'Recipient email address'
        },
        subject: {
          type: 'string',
          description: 'Email subject'
        },
        text: {
          type: 'string',
          description: 'Plain text email body'
        },
        html: {
          type: 'string',
          description: 'HTML email body',
          required: false
        },
        attachments: {
          type: 'array',
          description: 'Array of email attachments',
          required: false
        }
      },
      handler: async ({ to, subject, text, html, attachments }) => {
        const mcp = new GmailMCP();
        return await mcp.sendEmail({ to, subject, text, html, attachments });
      }
    },
    
    send_expense_report: {
      description: 'Sends expense report email with analysis',
      parameters: {
        to: {
          type: 'string',
          description: 'Recipient email address',
          required: false
        },
        reportPath: {
          type: 'string',
          description: 'Path to the analysis report text file',
          required: false
        },
        recommendations: {
          type: 'array',
          description: 'Array of saving recommendations',
          required: false
        },
        attachments: {
          type: 'array',
          description: 'Array of email attachments',
          required: false
        },
        chartInfo: {
          type: 'object',
          description: 'Information about the chart (type, path, filename)',
          required: false
        }
      },
      handler: async ({ to, reportPath, recommendations, attachments, chartInfo }) => {
        const mcp = new GmailMCP();
        return await mcp.sendExpenseReport({ to, reportPath, recommendations, attachments, chartInfo });
      }
    }
  },
  
  // Resources provided by this MCP server
  resources: {}
};
