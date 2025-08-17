#!/usr/bin/env node

// Suppress specific deprecation warnings
const originalEmitWarning = process.emitWarning;
process.emitWarning = function(warning, ...args) {
  // Suppress punycode deprecation warnings
  if (typeof warning === 'string' && warning.includes('punycode')) {
    return;
  }
  if (warning && warning.name === 'DeprecationWarning' && warning.message.includes('punycode')) {
    return;
  }
  return originalEmitWarning.call(this, warning, ...args);
};

// Import and start the server
import('./src/server.js').catch(error => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
