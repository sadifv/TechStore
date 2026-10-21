// controllers/aiController.js
const aiClient = require('../config/ai');
const logger = require('../config/logger');
const Product = require('../models/Product');
const { activeProductFilter } = require('../services/productAvailability');
const { toPublicProduct } = require('../services/productPricing');

const processAiChat = async (req, res) => {
  try {
    //  Validar que el cliente de IA esté configurado
    if (!aiClient) {
      logger.warn('Intento de usar IA sin GEMINI_API_KEY configurada');
      return res.status(503).json({
        success: false,
        error: 'El asistente de IA no está configurado. Contacta al administrador.',
      });
    }

    const message = req.body?.message;

    if (typeof message !== 'string' || !message.trim() || message.length > 500) {
      return res.status(400).json({
        success: false,
        error: 'El mensaje debe contener texto y no superar los 500 caracteres.',
      });
    }
    const normalizedMessage = message.trim();

    const products = await Product.find(
      activeProductFilter(),
      'name price category stock flashSale flashSaleEndsAt originalPrice',
    )
      .sort({ createdAt: -1 })
      .limit(30)
      .lean();

    const catalogContext =
      products.length > 0
        ? products
            .map((product) => toPublicProduct(product))
            .map(
              (p) => `- ${p.name} (${p.category}): $${p.price}${p.stock > 0 ? '' : ' [AGOTADO]'}`,
            )
            .join('\n')
        : 'No hay productos disponibles actualmente.';

    const systemPrompt = `Eres TechBot, el asistente virtual de TechStore, una tienda e-commerce de tecnología especializada en laptops, smartphones, auriculares y gadgets.

INSTRUCCIONES:
- Responde de forma amable, breve y profesional.
- Usa un tono cercano pero conciso (máximo 2-3 frases por respuesta).
- Cuando el usuario pregunte por productos, recomienda SOLO los del catálogo de abajo.
- Si mencionas un producto, incluye su precio exacto y nombre.
- Si un producto está marcado [AGOTADO], indícalo y sugiere una alternativa.
- Responde siempre en español.

CATÁLOGO DISPONIBLE:
${catalogContext}`;

    const sessionHistory = Array.isArray(req.session.chatHistory)
      ? req.session.chatHistory
          .filter(
            (entry) =>
              ['user', 'assistant'].includes(entry?.role) &&
              typeof entry.content === 'string' &&
              entry.content.length <= 500,
          )
          .slice(-20)
      : [];

    const messages = [
      { role: 'system', content: systemPrompt },
      ...sessionHistory,
      { role: 'user', content: normalizedMessage },
    ];

    const completion = await aiClient.chat.completions.create({
      model: 'gemini-3.5-flash-lite',
      messages,
      reasoning_effort: 'low',
      max_tokens: 300,
      temperature: 0.7,
    });

    const aiReply = completion.choices[0]?.message?.content?.trim();

    if (!aiReply) {
      logger.warn('La IA devolvió una respuesta vacía');
      return res.status(502).json({
        success: false,
        error: 'El asistente no pudo generar una respuesta. Intenta de nuevo.',
      });
    }

    if (!req.session.chatHistory) req.session.chatHistory = [];
    req.session.chatHistory.push(
      { role: 'user', content: normalizedMessage },
      { role: 'assistant', content: aiReply },
    );

    if (req.session.chatHistory.length > 20) {
      req.session.chatHistory = req.session.chatHistory.slice(-20);
    }

    logger.info(`El asistente respondió correctamente. Productos consultados: ${products.length}.`);

    res.status(200).json({ success: true, reply: aiReply });
  } catch (error) {
    const isTimeout =
      error.name === 'APIConnectionTimeoutError' ||
      error.code === 'ETIMEDOUT' ||
      error.name === 'AbortError';
    logger.error(
      `Error en aiController: ${error.message} [status=${error.status || 'n/a'}, code=${error.code || 'n/a'}]`,
      { stack: error.stack },
    );

    let userMessage = 'Ocurrió un error al procesar la respuesta del asistente.';

    if (error.status === 401 || error.status === 403) {
      userMessage = 'Error de autenticación con el servicio de IA. Revisa la API Key.';
    } else if (error.status === 429) {
      userMessage = 'El asistente está recibiendo muchas solicitudes. Intenta en unos segundos.';
    } else if (isTimeout) {
      userMessage =
        'Gemini está tardando demasiado en responder. Intenta de nuevo en unos segundos.';
    } else if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
      userMessage = 'No se pudo conectar con el servicio de IA. Revisa tu conexión.';
    }

    res.status(error.status || (isTimeout ? 504 : 500)).json({
      success: false,
      error: userMessage,
    });
  }
};

const getChatHistory = async (req, res) => {
  try {
    const history = req.session.chatHistory || [];
    res.status(200).json({ success: true, history });
  } catch (error) {
    logger.error(`Error al obtener historial: ${error.message}`);
    res.status(500).json({ success: false, error: 'Error al obtener el historial del chat.' });
  }
};

const clearChatHistory = async (req, res) => {
  try {
    req.session.chatHistory = [];
    res.status(200).json({ success: true, message: 'Historial del chat eliminado.' });
  } catch (error) {
    logger.error(`Error al limpiar historial: ${error.message}`);
    res.status(500).json({ success: false, error: 'Error al limpiar el historial.' });
  }
};

module.exports = {
  processAiChat,
  getChatHistory,
  clearChatHistory,
};
