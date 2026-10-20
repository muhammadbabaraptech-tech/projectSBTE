// Vercel serverless function entry point
// Exports the Express app from server.js as the handler
const app = require('../server.js');
module.exports = app;
