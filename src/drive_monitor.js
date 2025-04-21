/**
 * Google Drive Monitor
 * 
 * This script monitors a Google Drive folder for new expense files
 * and automatically triggers the financial workflow when a new file is detected.
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { GoogleDriveMCP } = require('./mcp/google_drive_mcp');
const { runWorkflow } = require('./index');
const config = require('../config/config.json');

// Path to store the state file (last processed file info)
const STATE_FILE_PATH = path.join(__dirname, '../temp/drive_monitor_state.json');

/**
 * Load the current state (last processed file info)
 * @returns {Object} The current state
 */
function loadState() {
  try {
    if (fs.existsSync(STATE_FILE_PATH)) {
      const stateData = fs.readFileSync(STATE_FILE_PATH, 'utf8');
      return JSON.parse(stateData);
    }
  } catch (error) {
    console.error('Error loading state file:', error);
  }
  
  // Default state if file doesn't exist or can't be parsed
  return {
    lastProcessedFileId: null,
    lastProcessedTimestamp: null,
    lastCheckTimestamp: Date.now()
  };
}

/**
 * Save the current state
 * @param {Object} state - The state to save
 */
function saveState(state) {
  try {
    fs.writeFileSync(STATE_FILE_PATH, JSON.stringify(state, null, 2));
  } catch (error) {
    console.error('Error saving state file:', error);
  }
}

/**
 * Check for new files in the expense folder
 * @returns {Promise<boolean>} True if a new file was found and processed
 */
async function checkForNewFiles() {
  const driveMcp = new GoogleDriveMCP();
  await driveMcp.initialize();
  
  // Get the current state
  const state = loadState();
  
  try {
    // Get the most recent file in the expense folder
    const folderPath = config.google_drive.expense_file_path;
    const mostRecentFile = await driveMcp.getMostRecentFileInFolder(folderPath);
    
    if (!mostRecentFile) {
      console.log('No files found in expense folder');
      return false;
    }
    
    // Update the last check timestamp
    state.lastCheckTimestamp = Date.now();
    
    // Check if this is a new file we haven't processed yet
    if (
      mostRecentFile.id !== state.lastProcessedFileId &&
      (!state.lastProcessedTimestamp || 
       new Date(mostRecentFile.createdTime) > new Date(state.lastProcessedTimestamp))
    ) {
      console.log(`New expense file detected: ${mostRecentFile.name} (${mostRecentFile.id})`);
      
      // Run the workflow
      console.log('Triggering financial workflow...');
      await runWorkflow();
      
      // Update the state with the processed file info
      state.lastProcessedFileId = mostRecentFile.id;
      state.lastProcessedTimestamp = mostRecentFile.createdTime;
      saveState(state);
      
      console.log('Workflow completed successfully for new file');
      return true;
    } else {
      console.log('No new expense files detected');
      saveState(state);
      return false;
    }
  } catch (error) {
    console.error('Error checking for new files:', error);
    saveState(state);
    return false;
  }
}

/**
 * Start monitoring the Google Drive folder
 * @param {number} intervalMinutes - How often to check for new files (in minutes)
 */
function startMonitoring(intervalMinutes = 15) {
  console.log(`Starting Google Drive monitor. Checking every ${intervalMinutes} minutes.`);
  
  // Check immediately on startup
  checkForNewFiles().catch(error => {
    console.error('Error in initial check:', error);
  });
  
  // Set up periodic checking
  const intervalMs = intervalMinutes * 60 * 1000;
  setInterval(() => {
    console.log(`Checking for new expense files (${new Date().toLocaleString()})`);
    checkForNewFiles().catch(error => {
      console.error('Error checking for new files:', error);
    });
  }, intervalMs);
}

// If this script is run directly, start monitoring
if (require.main === module) {
  // Get interval from command line args or environment, default to 15 minutes
  const intervalMinutes = parseInt(process.argv[2] || process.env.MONITOR_INTERVAL || '15', 10);
  startMonitoring(intervalMinutes);
}

module.exports = {
  checkForNewFiles,
  startMonitoring
};
