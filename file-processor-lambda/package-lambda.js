#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('📦 Creating Lambda deployment package...');

const outputFile = 'lambda-function.zip';

// Remove old zip if exists
if (fs.existsSync(outputFile)) {
  fs.unlinkSync(outputFile);
  console.log('🗑️  Removed old package');
}

// Check if running on Windows
const isWindows = process.platform === 'win32';

if (isWindows) {
  // Use PowerShell Compress-Archive on Windows
  console.log('🪟 Detected Windows, using PowerShell...');
  
  try {
    // Create zip using PowerShell
    execSync(`powershell -Command "Compress-Archive -Path src,node_modules -DestinationPath ${outputFile} -Force"`, {
      stdio: 'inherit'
    });
    
    // Get file size
    const stats = fs.statSync(outputFile);
    const fileSizeInMB = (stats.size / (1024 * 1024)).toFixed(2);
    console.log(`✅ Package created: ${outputFile} (${fileSizeInMB} MB)`);
  } catch (error) {
    console.error('❌ Failed to create package:', error.message);
    process.exit(1);
  }
} else {
  // Use zip command on Unix-like systems
  console.log('🐧 Detected Unix/Linux, using zip command...');
  
  try {
    execSync('zip -r lambda-function.zip src/ node_modules/', {
      stdio: 'inherit'
    });
    
    // Get file size
    const stats = fs.statSync(outputFile);
    const fileSizeInMB = (stats.size / (1024 * 1024)).toFixed(2);
    console.log(`✅ Package created: ${outputFile} (${fileSizeInMB} MB)`);
  } catch (error) {
    console.error('❌ Failed to create package:', error.message);
    console.error('💡 Please install zip: sudo apt-get install zip');
    process.exit(1);
  }
}
