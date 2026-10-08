// config/ai.js
const OpenAI = require('openai');

/**
 * Cliente de IA configurado para Google Gemini
 * a través del endpoint compatible con OpenAI.
 * 
 * API key GRATUITA en: https://aistudio.google.com/apikey
 */
const aiClient = new OpenAI({
  apiKey: process.env.GEMINI_API_KEY,
  baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai/'
});

// Validación temprana: avisar si falta la API Key al arrancar
if (!process.env.GEMINI_API_KEY) {
  console.warn('[AI] ⚠️  GEMINI_API_KEY no está definida en el .env. El asistente no funcionará.');
}

module.exports = aiClient;