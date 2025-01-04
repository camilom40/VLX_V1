const fs = require('fs');
const path = require('path');

// Define log file path
const logFilePath = path.join(__dirname, 'app.log');

// Function to append log messages to a file
function appendLog(message) {
  const timestamp = new Date().toISOString();
  const logMessage = `${timestamp} - ${message}\n`;

  fs.appendFile(logFilePath, logMessage, (err) => {
    if (err) {
      console.error(`Failed to write to log file: ${err.message}`, err);
    }
  });
}

// Exported logger object with methods for different log levels
module.exports = {
  info: (message) => {
    console.log(message);
    appendLog(`INFO: ${message}`);
  },
  error: (message, error) => {
    console.error(message, error);
    appendLog(`ERROR: ${message} - ${error.message}\nStack: ${error.stack}`);
  },
  debug: (message) => {
    console.debug(message);
    appendLog(`DEBUG: ${message}`);
  }
};