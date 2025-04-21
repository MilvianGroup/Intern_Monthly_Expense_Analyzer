/**
 * Authentication Server for Gmail OAuth 2.0
 * 
 * This server handles the OAuth 2.0 authentication flow for Gmail API.
 * It provides endpoints for initiating the authentication process and
 * handling the callback from Google.
 */

const express = require('express');
const { GmailOAuthMCP } = require('./mcp/gmail_oauth_mcp');
const app = express();
const port = 3000;

// Create an instance of the Gmail OAuth MCP
const gmailOAuthMCP = new GmailOAuthMCP();

app.get('/', (req, res) => {
  // Generate the authentication URL
  const authUrl = gmailOAuthMCP.getAuthUrl();
  
  // Render a simple HTML page with authentication button
  res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Gmail API OAuth 2.0 Authentication</title>
      <style>
        body {
          font-family: Arial, sans-serif;
          line-height: 1.6;
          color: #333;
          max-width: 800px;
          margin: 0 auto;
          padding: 20px;
        }
        h1 {
          color: #2c3e50;
        }
        .container {
          background-color: #f8f9fa;
          border-radius: 5px;
          padding: 20px;
          margin-top: 20px;
        }
        .btn {
          display: inline-block;
          background-color: #4285F4;
          color: white;
          padding: 10px 20px;
          text-decoration: none;
          border-radius: 5px;
          font-weight: bold;
          margin-top: 20px;
        }
        .info {
          margin-top: 30px;
          font-size: 14px;
        }
      </style>
    </head>
    <body>
      <h1>Gmail API OAuth 2.0 Authentication</h1>
      
      <div class="container">
        <p>This page helps you authenticate with Google to use the Gmail API for sending emails in the Monthly Financial Project.</p>
        <p>When you click the button below, you'll be redirected to Google's authentication page where you'll need to:</p>
        <ol>
          <li>Sign in to your Google account</li>
          <li>Review and accept the permissions requested</li>
          <li>Be redirected back to this application</li>
        </ol>
        
        <a href="${authUrl}" class="btn">Authenticate with Google</a>
      </div>
      
      <div class="info">
        <p>Note: This authentication process will grant the application permission to send emails on your behalf. The access token will be stored locally in the credentials directory.</p>
      </div>
    </body>
    </html>
  `);
});

app.get('/auth/google/callback', async (req, res) => {
  const { code } = req.query;
  
  if (!code) {
    return res.status(400).send('Authorization code not provided');
  }
  
  try {
    // Store the token
    const success = await gmailOAuthMCP.storeToken(code);
    
    if (success) {
      res.send(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Authentication Successful</title>
          <style>
            body {
              font-family: Arial, sans-serif;
              line-height: 1.6;
              color: #333;
              max-width: 800px;
              margin: 0 auto;
              padding: 20px;
            }
            h1 {
              color: #2c3e50;
            }
            .container {
              background-color: #f8f9fa;
              border-radius: 5px;
              padding: 20px;
              margin-top: 20px;
            }
            .success {
              color: #28a745;
              font-weight: bold;
            }
          </style>
        </head>
        <body>
          <h1>Authentication Successful</h1>
          
          <div class="container">
            <p class="success">Your Gmail OAuth 2.0 token has been stored successfully!</p>
            <p>You can now close this window and use the Gmail API to send emails.</p>
            <p>The token has been saved to: <code>credentials/gmail_oauth_token.json</code></p>
          </div>
        </body>
        </html>
      `);
    } else {
      res.status(500).send(`
        <h1>Authentication Failed</h1>
        <p>Failed to store OAuth 2.0 token. Please check the console for more information.</p>
      `);
    }
  } catch (error) {
    console.error('Error in OAuth callback:', error);
    res.status(500).send(`
      <h1>Authentication Error</h1>
      <p>Error: ${error.message}</p>
      <p>Please check the console for more information.</p>
    `);
  }
});

// Start the server
app.listen(port, () => {
  console.log(`Authentication server running at http://localhost:${port}`);
  console.log('Open this URL in your browser to start the authentication process');
});
