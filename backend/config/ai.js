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
      timeout: 30000, // 30s máximo por petición
      maxRetries: 2, // 2 reintentos automáticos
    })
  : null;

module.exports = aiClient;
