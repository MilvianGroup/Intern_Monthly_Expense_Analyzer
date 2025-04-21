/**
 * Google Drive MCP Server
 * 
 * This MCP server provides tools to interact with Google Drive,
 * specifically for retrieving expense report files.
 */

const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');
const config = require('../../config/config.json');

// Load credentials from environment or a secure location
// In a production environment, these would be securely stored
// In demo mode, use mock credentials
const isDemoMode = process.env.DEMO_MODE === 'true' || process.argv.includes('--demo');

const CREDENTIALS = isDemoMode
  ? { client_email: 'demo@example.com', private_key: 'demo-key' }
  : process.env.GOOGLE_CREDENTIALS 
    ? JSON.parse(process.env.GOOGLE_CREDENTIALS)
    : require('../../credentials/google_credentials.json');

class GoogleDriveMCP {
  constructor() {
    this.auth = null;
    this.drive = null;
    this.initialized = false;
  }

  /**
   * Initialize the Google Drive client
   */
  async initialize() {
    try {
      const { client_email, private_key } = CREDENTIALS;
      
      this.auth = new google.auth.JWT(
        client_email,
        null,
        private_key,
        ['https://www.googleapis.com/auth/drive.readonly']
      );
      
      this.drive = google.drive({ version: 'v3', auth: this.auth });
      this.initialized = true;
      
      console.log('Google Drive MCP initialized successfully');
      return true;
    } catch (error) {
      console.error('Failed to initialize Google Drive MCP:', error);
      return false;
    }
  }

  /**
   * Find a file by name in Google Drive
   * @param {string} fileName - The name of the file to find
   * @param {string} filePath - Optional path/folder where the file is located
   * @returns {Promise<Object|null>} - File metadata or null if not found
   */
  async findFile(fileName, filePath = null) {
    if (!this.initialized) await this.initialize();
    
    try {
      let query = `name = '${fileName}' and trashed = false`;
      
      if (filePath) {
        // First find the folder ID
        const folderResponse = await this.drive.files.list({
          q: `name = '${path.basename(filePath)}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
          fields: 'files(id, name)'
        });
        
        if (folderResponse.data.files.length > 0) {
          const folderId = folderResponse.data.files[0].id;
          query += ` and '${folderId}' in parents`;
        }
      }
      
      const response = await this.drive.files.list({
        q: query,
        fields: 'files(id, name, mimeType, createdTime)',
        orderBy: 'createdTime desc'
      });
      
      if (response.data.files.length === 0) {
        console.log(`File '${fileName}' not found in Google Drive`);
        return null;
      }
      
      return response.data.files[0];
    } catch (error) {
      console.error('Error finding file in Google Drive:', error);
      return null;
    }
  }

  /**
   * Download a file from Google Drive by ID
   * @param {string} fileId - The ID of the file to download
   * @param {string} outputPath - Where to save the downloaded file
   * @returns {Promise<string|null>} - Path to the downloaded file or null if failed
   */
  async downloadFile(fileId, outputPath = null) {
    if (!this.initialized) await this.initialize();
    
    try {
      const dest = outputPath || path.join(__dirname, '../../temp', `gdrive_${Date.now()}.csv`);
      
      // Ensure the directory exists
      const dir = path.dirname(dest);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      
      const response = await this.drive.files.get(
        { fileId, alt: 'media' },
        { responseType: 'stream' }
      );
      
      return new Promise((resolve, reject) => {
        const dest_stream = fs.createWriteStream(dest);
        response.data
          .on('error', err => {
            reject(err);
          })
          .pipe(dest_stream)
          .on('error', err => {
            reject(err);
          })
          .on('finish', () => {
            console.log(`File downloaded successfully to ${dest}`);
            resolve(dest);
          });
      });
    } catch (error) {
      console.error('Error downloading file from Google Drive:', error);
      return null;
    }
  }

  /**
   * Get the most recent file from a folder in Google Drive
   * @param {string} folderPath - The path to the folder
   * @returns {Promise<Object|null>} - Most recent file metadata or null if not found
   */
  async getMostRecentFileInFolder(folderPath) {
    if (!this.initialized) await this.initialize();
    
    try {
      // First find the folder ID
      const folderName = path.basename(folderPath);
      const folderResponse = await this.drive.files.list({
        q: `name = '${folderName}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
        fields: 'files(id, name)'
      });
      
      if (folderResponse.data.files.length === 0) {
        console.error(`Folder '${folderName}' not found in Google Drive`);
        return null;
      }
      
      const folderId = folderResponse.data.files[0].id;
      
      // Get all files in the folder, ordered by most recent first
      const response = await this.drive.files.list({
        q: `'${folderId}' in parents and trashed = false`,
        fields: 'files(id, name, mimeType, createdTime)',
        orderBy: 'createdTime desc'
      });
      
      if (response.data.files.length === 0) {
        console.error(`No files found in folder '${folderName}'`);
        return null;
      }
      
      // Return the most recent file (first in the list)
      return response.data.files[0];
    } catch (error) {
      console.error('Error finding most recent file in folder:', error);
      return null;
    }
  }

  /**
   * Get the expense report from Google Drive
   * @returns {Promise<string|null>} - Path to the downloaded expense report or null if failed
   */
  async getExpenseReport() {
    const { expense_file_path } = config.google_drive;
    
    try {
      // Get the most recent file in the expense folder
      const file = await this.getMostRecentFileInFolder(expense_file_path);
      
      if (!file) {
        console.error(`No expense reports found in '${expense_file_path}'`);
        return null;
      }
      
      console.log(`Found most recent expense report: ${file.name}`);
      
      const outputPath = path.join(__dirname, '../../temp', file.name);
      return await this.downloadFile(file.id, outputPath);
    } catch (error) {
      console.error('Error retrieving expense report:', error);
      return null;
    }
  }
}

// Export the MCP server definition and the GoogleDriveMCP class
module.exports = {
  name: 'google-drive-mcp',
  description: 'MCP server for Google Drive operations',
  version: '1.0.0',
  
  // Export the GoogleDriveMCP class
  GoogleDriveMCP: GoogleDriveMCP,
  
  // Tools provided by this MCP server
  tools: {
    get_expense_report: {
      description: 'Retrieves the expense report from Google Drive',
      parameters: {},
      handler: async () => {
        const mcp = new GoogleDriveMCP();
        return await mcp.getExpenseReport();
      }
    },
    
    find_file: {
      description: 'Finds a file in Google Drive by name',
      parameters: {
        fileName: {
          type: 'string',
          description: 'Name of the file to find'
        },
        filePath: {
          type: 'string',
          description: 'Optional path/folder where the file is located',
          required: false
        }
      },
      handler: async ({ fileName, filePath }) => {
        const mcp = new GoogleDriveMCP();
        return await mcp.findFile(fileName, filePath);
      }
    },
    
    get_most_recent_file: {
      description: 'Gets the most recent file from a folder in Google Drive',
      parameters: {
        folderPath: {
          type: 'string',
          description: 'Path to the folder in Google Drive'
        }
      },
      handler: async ({ folderPath }) => {
        const mcp = new GoogleDriveMCP();
        return await mcp.getMostRecentFileInFolder(folderPath);
      }
    },
    
    download_file: {
      description: 'Downloads a file from Google Drive by ID',
      parameters: {
        fileId: {
          type: 'string',
          description: 'ID of the file to download'
        },
        outputPath: {
          type: 'string',
          description: 'Where to save the downloaded file',
          required: false
        }
      },
      handler: async ({ fileId, outputPath }) => {
        const mcp = new GoogleDriveMCP();
        return await mcp.downloadFile(fileId, outputPath);
      }
    }
  },
  
  // Resources provided by this MCP server
  resources: {}
};
