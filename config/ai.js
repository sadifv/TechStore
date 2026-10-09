const OpenAI = require('openai');
const logger = require('./logger');

const aiClient = new OpenAI({
  apiKey: process.env.GEMINI_API_KEY,
  baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai/'
});

if (!process.env.GEMINI_API_KEY) {
  logger.warn('[AI] ⚠️ GEMINI_API_KEY no está definida en el .env. El asistente no funcionará.');
}

module.exports = aiClient;