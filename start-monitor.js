/**
 * Simple startup script for the Google Drive expense folder monitor
 * 
 * This script starts the monitor as a detached process that will continue
 * running in the background even after the terminal is closed.
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

// Default interval in minutes
const DEFAULT_INTERVAL = 15;

// Get interval from command line args
const args = process.argv.slice(2);
const interval = args.length > 0 ? parseInt(args[0], 10) : DEFAULT_INTERVAL;

console.log(`Starting Google Drive expense folder monitor (checking every ${interval} minutes)...`);

// Create logs directory if it doesn't exist
const logsDir = path.join(__dirname, 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Create log files
const outLog = fs.openSync(path.join(logsDir, 'monitor-out.log'), 'a');
const errLog = fs.openSync(path.join(logsDir, 'monitor-err.log'), 'a');

// Start the monitor as a detached process
const monitor = spawn('node', [path.join(__dirname, 'src/drive_monitor.js'), interval.toString()], {
  detached: true,
  stdio: ['ignore', outLog, errLog]
});

// Unref the child process so the parent can exit
monitor.unref();

console.log('Monitor started in the background.');
console.log(`Logs are being written to: ${logsDir}`);
console.log('\nTo stop the monitor, you\'ll need to find and terminate the Node.js process:');
console.log('- On Windows: Use Task Manager');
console.log('- On macOS/Linux: Use "ps aux | grep drive_monitor" to find the process ID, then "kill <PID>"');
