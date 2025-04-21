/**
 * Example: Send Email with Gmail OAuth 2.0 Authentication
 * 
 * This example demonstrates how to send an email using the Gmail API
 * with OAuth 2.0 authentication.
 * 
 * Before running this example:
 * 1. Set up OAuth 2.0 credentials in the .env file
 * 2. Run the authentication server: npm run auth
 * 3. Complete the authentication process in the browser
 */

require('dotenv').config();
const { registerMCPServers } = require('../mcp/mcp_config');

/**
 * Send a test email using Gmail OAuth 2.0 authentication
 */
async function sendTestEmail() {
  try {
    console.log('Initializing MCP servers...');
    const mcpServers = registerMCPServers();
    
    // Get the Gmail OAuth MCP
    const gmailOAuthMCP = mcpServers['gmail-oauth-mcp'];
    
    if (!gmailOAuthMCP) {
      throw new Error('Gmail OAuth MCP not found. Make sure it is registered in mcp_config.js');
    }
    
    // Create an instance of the Gmail OAuth MCP
    const { GmailOAuthMCP } = require('../mcp/gmail_oauth_mcp');
    const gmailMCP = new GmailOAuthMCP();
    
    // Initialize the MCP
    const initialized = await gmailMCP.initialize();
    
    if (!initialized) {
      throw new Error('Failed to initialize Gmail OAuth MCP. Make sure you have completed the authentication process.');
    }
    
    console.log('Gmail OAuth MCP initialized successfully');
    
    // Recipient email address
    const recipient = process.argv[2] || 'test@example.com';
    
    // Send a test email
    console.log(`Sending test email to ${recipient}...`);
    
    const result = await gmailMCP.sendEmail({
      to: recipient,
      subject: 'Test Email with OAuth 2.0',
      text: 'This is a test email sent using the Gmail API with OAuth 2.0 authentication',
      html: `
        <html>
          <head>
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              h1 { color: #2c3e50; }
              .success { color: #28a745; font-weight: bold; }
              .footer { margin-top: 30px; font-size: 12px; color: #7f8c8d; }
            </style>
          </head>
          <body>
            <div class="container">
              <h1>Test Email with OAuth 2.0</h1>
              <p>This is a test email sent using the Gmail API with OAuth 2.0 authentication.</p>
              <p class="success">If you're reading this, the authentication was successful!</p>
              <div class="footer">
                <p>Sent from Monthly Financial Project on ${new Date().toLocaleDateString()}</p>
              </div>
            </div>
          </body>
        </html>
      `
    });
    
    if (result) {
      console.log('Test email sent successfully!');
    } else {
      console.error('Failed to send test email');
    }
  } catch (error) {
    console.error('Error sending test email:', error);
  }
}

// Run the example
sendTestEmail().catch(error => {
  console.error('Unhandled error:', error);
  process.exit(1);
});
