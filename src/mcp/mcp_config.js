/**
 * MCP Configuration
 * 
 * This file configures and registers the MCP servers used in the application.
 * Simplified to match the original vision from Arman_PoC.drawio
 */

const path = require('path');
const fs = require('fs');

// Import MCP servers
const googleDriveMCP = require('./google_drive_mcp');
const gmailMCP = require('./gmail_mcp');

/**
 * Register MCP servers
 * @returns {Object} - Object containing registered MCP servers
 */
function registerMCPServers() {
  // Create credentials directory if it doesn't exist
  const credentialsDir = path.join(__dirname, '../../credentials');
  if (!fs.existsSync(credentialsDir)) {
    fs.mkdirSync(credentialsDir, { recursive: true });
  }
  
  // Check if Google credentials file exists
  const googleCredentialsPath = path.join(credentialsDir, 'google_credentials.json');
  if (!fs.existsSync(googleCredentialsPath)) {
    console.warn(`
WARNING: Google credentials file not found at ${googleCredentialsPath}
You need to create this file with your Google API credentials.
See README.md for instructions on setting up Google API credentials.
    `);
    
    // Create a template credentials file
    const templateCredentials = {
      "type": "service_account",
      "project_id": "your-project-id",
      "private_key_id": "your-private-key-id",
      "private_key": "-----BEGIN PRIVATE KEY-----\nYOUR_PRIVATE_KEY_HERE\n-----END PRIVATE KEY-----\n",
      "client_email": "your-service-account@your-project-id.iam.gserviceaccount.com",
      "client_id": "your-client-id",
      "auth_uri": "https://accounts.google.com/o/oauth2/auth",
      "token_uri": "https://oauth2.googleapis.com/token",
      "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
      "client_x509_cert_url": "https://www.googleapis.com/robot/v1/metadata/x509/your-service-account%40your-project-id.iam.gserviceaccount.com"
    };
    
    fs.writeFileSync(
      googleCredentialsPath,
      JSON.stringify(templateCredentials, null, 2)
    );
    
    console.log(`Created template credentials file at ${googleCredentialsPath}`);
    console.log('Please update this file with your actual Google API credentials.');
  }
  
  // Register MCP servers
  const mcpServers = {
    'google-drive-mcp': googleDriveMCP,
    'gmail-mcp': gmailMCP
  };
  
  console.log('Registered MCP servers:');
  Object.keys(mcpServers).forEach(name => {
    console.log(`- ${name} (${mcpServers[name].description})`);
  });
  
  return mcpServers;
}

module.exports = {
  registerMCPServers
};
