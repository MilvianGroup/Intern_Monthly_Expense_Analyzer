/**
 * Gmail OAuth MCP Server
 * 
 * This MCP server provides tools to interact with Gmail using OAuth 2.0 authentication,
 * specifically for sending expense reports and analysis.
 */

const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');
const config = require('../../config/config.json');

class GmailOAuthMCP {
  constructor() {
    this.auth = null;
    this.gmail = null;
    this.initialized = false;
    
    // OAuth2 client configuration
    this.oAuth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    );
  }

  /**
   * Initialize the Gmail client with OAuth2 authentication
   */
  async initialize() {
    try {
      // Check if we have stored tokens
      const tokenPath = path.join(__dirname, '../../credentials/gmail_oauth_token.json');
      
      if (fs.existsSync(tokenPath)) {
        // Use stored token
        const token = JSON.parse(fs.readFileSync(tokenPath, 'utf8'));
        this.oAuth2Client.setCredentials(token);
      } else {
        console.log('No stored OAuth tokens found. Please authenticate first.');
        return false;
      }
      
      // Initialize Gmail API client
      this.gmail = google.gmail({ version: 'v1', auth: this.oAuth2Client });
      this.initialized = true;
      console.log('Gmail OAuth MCP initialized successfully');
      return true;
    } catch (error) {
      console.error('Failed to initialize Gmail OAuth MCP:', error);
      return false;
    }
  }

  /**
   * Generate authentication URL for OAuth2 flow
   * @returns {string} - Authentication URL
   */
  getAuthUrl() {
    const scopes = [
      'https://www.googleapis.com/auth/gmail.send',
      'https://www.googleapis.com/auth/gmail.compose'
    ];
    
    return this.oAuth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: scopes,
      prompt: 'consent'
    });
  }

  /**
   * Store OAuth2 token received after authentication
   * @param {string} code - Authorization code from OAuth2 callback
   * @returns {Promise<boolean>} - Success status
   */
  async storeToken(code) {
    try {
      const { tokens } = await this.oAuth2Client.getToken(code);
      this.oAuth2Client.setCredentials(tokens);
      
      // Store the token for future use
      const tokenPath = path.join(__dirname, '../../credentials/gmail_oauth_token.json');
      fs.writeFileSync(tokenPath, JSON.stringify(tokens));
      
      console.log('OAuth2 token stored successfully');
      return true;
    } catch (error) {
      console.error('Error storing OAuth2 token:', error);
      return false;
    }
  }

  /**
   * Send an email using Gmail API with OAuth2 authentication
   * @param {Object} options - Email options
   * @param {string} options.to - Recipient email address
   * @param {string} options.subject - Email subject
   * @param {string} options.text - Plain text email body
   * @param {string} options.html - HTML email body
   * @returns {Promise<boolean>} - Success status
   */
  async sendEmail({ to, subject, text, html }) {
    if (!this.initialized) await this.initialize();
    
    try {
      console.log('Preparing to send email...');
      
      // Create email content
      const utf8Subject = `=?utf-8?B?${Buffer.from(subject).toString('base64')}?=`;
      const messageParts = [
        `From: ${config.user.name} <${config.user.email}>`,
        `To: ${to}`,
        `Subject: ${utf8Subject}`,
        'MIME-Version: 1.0',
        'Content-Type: text/html; charset=utf-8',
        '',
        html || text
      ];
      const message = messageParts.join('\n');
      
      // Encode the message
      const encodedMessage = Buffer.from(message)
        .toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');
      
      // Send the message
      const res = await this.gmail.users.messages.send({
        userId: 'me',
        requestBody: {
          raw: encodedMessage
        }
      });
      
      console.log('Email sent successfully:', res.data.id);
      return true;
    } catch (error) {
      console.error('Error sending email:', error);
      return false;
    }
  }

  /**
   * Send expense report email with analysis and chart
   * @param {Object} options - Email options
   * @param {string} options.to - Recipient email address
   * @param {string} options.reportPath - Path to the analysis report text file
   * @param {string} options.chartPath - Path to the chart image file
   * @param {Array} options.recommendations - Array of saving recommendations
   * @returns {Promise<boolean>} - Success status
   */
  async sendExpenseReport({ to, reportPath, chartPath, recommendations = [] }) {
    if (!to) to = config.user.email;
    
    try {
      console.log('Preparing to send expense report email...');
      
      // Read report content if path is provided
      let reportContent = '';
      if (reportPath && fs.existsSync(reportPath)) {
        reportContent = fs.readFileSync(reportPath, 'utf8');
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
              .chart { margin: 20px 0; text-align: center; }
              .recommendations { background-color: #f8f9fa; padding: 15px; border-radius: 5px; }
              .recommendation-item { margin-bottom: 10px; padding-left: 20px; position: relative; }
              .recommendation-item:before { content: "→"; position: absolute; left: 0; color: #3498db; }
              .footer { margin-top: 30px; font-size: 12px; color: #7f8c8d; }
            </style>
          </head>
          <body>
            <div class="container">
              <h1>${config.report.title}</h1>
              <p>Hello ${config.user.name},</p>
              <p>Here is your monthly expense analysis report.</p>
              
              <div class="chart">
                <h2>Expense Breakdown</h2>
                <p>Please see the attached HTML file for an interactive expense chart.</p>
              </div>
              
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
      
      // Send the email
      const emailSent = await this.sendEmail({
        to,
        subject: config.report.subject,
        html: htmlContent
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

// Export the MCP server definition and the GmailOAuthMCP class
module.exports = {
  name: 'gmail-oauth-mcp',
  description: 'MCP server for Gmail operations using OAuth 2.0',
  version: '1.0.0',
  
  // Export the GmailOAuthMCP class
  GmailOAuthMCP: GmailOAuthMCP,
  
  // Tools provided by this MCP server
  tools: {
    get_auth_url: {
      description: 'Gets the OAuth2 authentication URL',
      parameters: {},
      handler: async () => {
        const mcp = new GmailOAuthMCP();
        return mcp.getAuthUrl();
      }
    },
    
    store_token: {
      description: 'Stores the OAuth2 token received after authentication',
      parameters: {
        code: {
          type: 'string',
          description: 'Authorization code from OAuth2 callback'
        }
      },
      handler: async ({ code }) => {
        const mcp = new GmailOAuthMCP();
        return await mcp.storeToken(code);
      }
    },
    
    send_email: {
      description: 'Sends an email using OAuth2 authentication',
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
          description: 'Plain text email body',
          required: false
        },
        html: {
          type: 'string',
          description: 'HTML email body',
          required: false
        }
      },
      handler: async ({ to, subject, text, html }) => {
        const mcp = new GmailOAuthMCP();
        return await mcp.sendEmail({ to, subject, text, html });
      }
    },
    
    send_expense_report: {
      description: 'Sends expense report email with analysis and chart',
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
        chartPath: {
          type: 'string',
          description: 'Path to the chart image file',
          required: false
        },
        recommendations: {
          type: 'array',
          description: 'Array of saving recommendations',
          required: false
        }
      },
      handler: async ({ to, reportPath, chartPath, recommendations }) => {
        const mcp = new GmailOAuthMCP();
        return await mcp.sendExpenseReport({ to, reportPath, chartPath, recommendations });
      }
    }
  },
  
  // Resources provided by this MCP server
  resources: {}
};
