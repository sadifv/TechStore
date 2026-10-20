const OpenAI = require('openai');
const logger = require('./logger');

// Validación temprana
const hasApiKey = Boolean(process.env.GEMINI_API_KEY);

if (!hasApiKey) {
  logger.warn('[AI] ⚠️ GEMINI_API_KEY no está definida en el .env. El asistente no funcionará.');
}

// ✅ Si no hay API key, exportamos null
const aiClient = hasApiKey
  ? new OpenAI({
      apiKey: process.env.GEMINI_API_KEY,
      baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai/',
      // Netlify's proxy rewrites time out after 26 seconds. Leave a small
      // margin for the backend and session middleware to finish the response.
      timeout: 22000,
      maxRetries: 0,
    })
  : null;

module.exports = aiClient;
