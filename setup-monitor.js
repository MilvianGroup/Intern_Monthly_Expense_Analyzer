/**
 * Setup script for the Google Drive expense folder monitor
 * 
 * This script helps set up the monitoring service by:
 * 1. Installing PM2 if not already installed
 * 2. Configuring the monitor interval
 * 3. Starting the monitor as a background service
 * 4. Optionally setting up the monitor to start on system boot
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

/**
 * Execute a command and return the output
 * @param {string} command - The command to execute
 * @returns {string} The command output
 */
function executeCommand(command) {
  try {
    return execSync(command, { encoding: 'utf8' });
  } catch (error) {
    console.error(`Error executing command: ${command}`);
    console.error(error.message);
    return null;
  }
}

/**
 * Check if PM2 is installed
 * @returns {boolean} True if PM2 is installed
 */
function isPM2Installed() {
  try {
    executeCommand('pm2 --version');
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Install PM2 globally
 */
function installPM2() {
  console.log('Installing PM2 globally...');
  try {
    executeCommand('npm install -g pm2');
    console.log('PM2 installed successfully.');
    return true;
  } catch (error) {
    console.error('Failed to install PM2 globally. This might be due to permission issues.');
    console.log('\nPlease try one of the following:');
    console.log('1. Run the command with administrator/sudo privileges:');
    console.log('   - On Windows: Run Command Prompt as Administrator and execute: npm install -g pm2');
    console.log('   - On macOS/Linux: Execute: sudo npm install -g pm2');
    console.log('\n2. Use the local PM2 from this project instead:');
    console.log('   npx pm2 start ecosystem.config.js');
    console.log('\n3. Use the simple monitor script that doesn\'t require PM2:');
    console.log('   node src/drive_monitor.js');
    return false;
  }
}

/**
 * Update the ecosystem.config.js file with the specified interval
 * @param {number} interval - The interval in minutes
 */
function updateEcosystemConfig(interval) {
  const configPath = path.join(__dirname, 'ecosystem.config.js');
  
  if (!fs.existsSync(configPath)) {
    console.error('ecosystem.config.js not found. Please make sure you are running this script from the project root directory.');
    process.exit(1);
  }
  
  let configContent = fs.readFileSync(configPath, 'utf8');
  
  // Update the interval in the config file
  configContent = configContent.replace(
    /MONITOR_INTERVAL: ['"]?\d+['"]?/,
    `MONITOR_INTERVAL: '${interval}'`
  );
  
  fs.writeFileSync(configPath, configContent);
  console.log(`Updated ecosystem.config.js with interval: ${interval} minutes`);
}

/**
 * Start the monitor as a background service
 */
function startMonitor() {
  console.log('Starting the monitor as a background service...');
  executeCommand('npm run monitor:daemon');
  console.log('Monitor started successfully.');
  
  // Display the status
  const status = executeCommand('pm2 status expense-monitor');
  console.log('\nCurrent status:');
  console.log(status);
}

/**
 * Set up the monitor to start on system boot
 */
function setupAutostart() {
  console.log('Setting up the monitor to start on system boot...');
  executeCommand('pm2 startup');
  executeCommand('pm2 save');
  console.log('Autostart configured successfully.');
}

/**
 * Ask for the monitor interval
 * @returns {Promise<number>} The interval in minutes
 */
const askInterval = () => {
  return new Promise((resolve) => {
    rl.question('How often should the monitor check for new files? (in minutes, default: 15): ', (answer) => {
      const interval = parseInt(answer || '15', 10);
      resolve(interval);
    });
  });
};

/**
 * Ask if the user wants to start the monitor now
 * @returns {Promise<boolean>} True if the user wants to start the monitor now
 */
const askStartNow = () => {
  return new Promise((resolve) => {
    rl.question('Do you want to start the monitor now? (y/n, default: y): ', (answer) => {
      const startNow = answer.toLowerCase() !== 'n';
      resolve(startNow);
    });
  });
};

/**
 * Ask if the user wants to set up autostart
 * @returns {Promise<boolean>} True if the user wants to set up autostart
 */
const askAutostart = () => {
  return new Promise((resolve) => {
    rl.question('Do you want the monitor to start automatically on system boot? (y/n, default: n): ', (answer) => {
      const autostart = answer.toLowerCase() === 'y';
      resolve(autostart);
    });
  });
};

/**
 * Main setup function
 */
async function setup() {
  console.log('=== Google Drive Expense Monitor Setup ===\n');
  
  // Check if PM2 is installed
  let pm2Available = isPM2Installed();
  
  if (!pm2Available) {
    console.log('PM2 is not installed or not in your PATH.');
    
    // Ask if the user wants to install PM2
    const installPm2 = await new Promise((resolve) => {
      rl.question('Do you want to try installing PM2 globally? (y/n, default: y): ', (answer) => {
        const install = answer.toLowerCase() !== 'n';
        resolve(install);
      });
    });
    
    if (installPm2) {
      pm2Available = installPM2();
    }
    
    if (!pm2Available) {
      console.log('\nSince PM2 is not available, we\'ll set up the monitor to run directly.');
      
      // Ask for the monitor interval
      const interval = await askInterval();
      
      // Create a simple startup script
      const scriptPath = path.join(__dirname, 'start-monitor.js');
      const scriptContent = `
/**
 * Simple startup script for the Google Drive expense folder monitor
 */
const { spawn } = require('child_process');
const path = require('path');

// Start the monitor as a detached process
const monitor = spawn('node', [path.join(__dirname, 'src/drive_monitor.js'), '${interval}'], {
  detached: true,
  stdio: 'ignore'
});

// Unref the child process so the parent can exit
monitor.unref();

console.log('Monitor started in the background.');
console.log('To stop it, you\'ll need to find and terminate the Node.js process.');
console.log('On Windows: Use Task Manager');
console.log('On macOS/Linux: Use "ps aux | grep drive_monitor" to find the process ID, then "kill <PID>"');
`;
      
      fs.writeFileSync(scriptPath, scriptContent);
      console.log(`\nCreated a simple startup script: ${scriptPath}`);
      console.log('You can start the monitor with: node start-monitor.js');
      
      // Ask if the user wants to start the monitor now
      const startNow = await askStartNow();
      if (startNow) {
        console.log('Starting the monitor...');
        executeCommand('node start-monitor.js');
        console.log('Monitor started in the background.');
      }
      
      console.log('\n=== Setup Complete ===');
      console.log(`The monitor will check for new files every ${interval} minutes.`);
      console.log('\nTo start the monitor: node start-monitor.js');
      console.log('To stop it, you\'ll need to find and terminate the Node.js process.');
      
      rl.close();
      return;
    }
  } else {
    console.log('PM2 is already installed.');
  }
  
  const interval = await askInterval();
  updateEcosystemConfig(interval);
  
  const startNow = await askStartNow();
  if (startNow) {
    startMonitor();
  }
  
  const autostart = await askAutostart();
  if (autostart) {
    setupAutostart();
  }
  
  console.log('\n=== Setup Complete ===');
  console.log(`The monitor will check for new files every ${interval} minutes.`);
  
  if (startNow) {
    console.log('The monitor is now running in the background.');
    console.log('You can check its status with: npm run monitor:status');
    console.log('You can view its logs with: npm run monitor:logs');
    console.log('You can stop it with: npm run monitor:stop');
  } else {
    console.log('You can start the monitor with: npm run monitor:daemon');
  }
  
  if (autostart) {
    console.log('The monitor will start automatically when your system boots up.');
  }
  
  rl.close();
}

// Run the setup
setup().catch(error => {
  console.error('Error during setup:', error);
  rl.close();
  process.exit(1);
});
