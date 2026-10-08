// controllers/aiController.js
const aiClient = require('../config/ai');
const logger = require('../config/logger');
const Product = require('../models/Product');

// @desc    Procesar consultas del asistente de IA
// @route   POST /api/ai/chat
// @access  Private (requiere login)
const processAiChat = async (req, res) => {
  try {
    const { message } = req.body;

    if (!message || message.trim() === '') {
      return res.status(400).json({
        success: false,
        error: 'El mensaje no puede estar vacío.'
      });
    }

    // 1. Obtener catálogo real desde MongoDB (máximo 30 productos)
    const products = await Product.find({}, 'name price category stock')
      .sort({ createdAt: -1 })
      .limit(30)
      .lean();

    // 2. Construir el contexto del catálogo
    const catalogContext = products.length > 0
      ? products.map(p => `- ${p.name} (${p.category}): $${p.price}${p.stock > 0 ? '' : ' [AGOTADO]'}`).join('\n')
      : 'No hay productos disponibles actualmente.';

    // 3. System prompt con catálogo inyectado
    const systemPrompt = `Eres TechBot, el asistente virtual de TechStore, una tienda e-commerce de tecnología especializada en laptops, smartphones, auriculares y gadgets.

INSTRUCCIONES:
- Responde de forma amable, breve y profesional.
- Usa un tono cercano pero conciso (máximo 2-3 frases por respuesta).
- Cuando el usuario pregunte por productos, recomienda SOLO los del catálogo de abajo.
- Si mencionas un producto, incluye su precio exacto y nombre.
- Si un producto está marcado [AGOTADO], indícalo y sugiere una alternativa.
- Si el usuario pregunta por algo que no está en el catálogo, dile amablemente que no lo tienes y ofrece alternativas cercanas.
- Responde siempre en español.

CATÁLOGO DISPONIBLE:
${catalogContext}`;

    // 4. Obtener historial de la sesión (si existe)
    const sessionHistory = req.session.chatHistory || [];

    // 5. Construir mensajes para la IA (system + historial + mensaje nuevo)
    const messages = [
      { role: 'system', content: systemPrompt },
      ...sessionHistory,
      { role: 'user', content: message }
    ];

    // 6. Llamada a la API de Gemini
    const completion = await aiClient.chat.completions.create({
      model: 'gemini-3.8-flash',
      messages,
      max_tokens: 500,
      temperature: 0.7
    });

    const aiReply = completion.choices[0]?.message?.content?.trim();

    if (!aiReply) {
      logger.warn('La IA devolvió una respuesta vacía');
      return res.status(502).json({
        success: false,
        error: 'El asistente no pudo generar una respuesta. Intenta de nuevo.'
      });
    }

    // 7. Guardar en el historial de la sesión
    if (!req.session.chatHistory) req.session.chatHistory = [];
    req.session.chatHistory.push(
      { role: 'user', content: message },
      { role: 'assistant', content: aiReply }
    );

    // Limitar a los últimos 20 mensajes (10 intercambios)
    if (req.session.chatHistory.length > 20) {
      req.session.chatHistory = req.session.chatHistory.slice(-20);
    }

    logger.info(`IA respondió a "${message.substring(0, 50)}..." - Catálogo: ${products.length} productos`);

    res.status(200).json({
      success: true,
      reply: aiReply
    });

  } catch (error) {
    logger.error(`Error en aiController: ${error.message}`, { stack: error.stack });

    let userMessage = 'Ocurrió un error al procesar la respuesta del asistente.';

    if (error.status === 401 || error.status === 403) {
      userMessage = 'Error de autenticación con el servicio de IA. Revisa la API Key.';
    } else if (error.status === 429) {
      userMessage = 'El asistente está recibiendo muchas solicitudes. Intenta en unos segundos.';
    } else if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
      userMessage = 'No se pudo conectar con el servicio de IA. Revisa tu conexión.';
    }

    res.status(error.status || 500).json({
      success: false,
      error: userMessage
    });
  }
};

// @desc    Obtener el historial del chat del usuario actual
// @route   GET /api/ai/history
// @access  Private
const getChatHistory = async (req, res) => {
  try {
    const history = req.session.chatHistory || [];
    res.status(200).json({
      success: true,
      history
    });
  } catch (error) {
    logger.error(`Error al obtener historial: ${error.message}`);
    res.status(500).json({
      success: false,
      error: 'Error al obtener el historial del chat.'
    });
  }
};

// @desc    Limpiar el historial del chat del usuario actual
// @route   DELETE /api/ai/history
// @access  Private
const clearChatHistory = async (req, res) => {
  try {
    req.session.chatHistory = [];
    res.status(200).json({
      success: true,
      message: 'Historial del chat eliminado.'
    });
  } catch (error) {
    logger.error(`Error al limpiar historial: ${error.message}`);
    res.status(500).json({
      success: false,
      error: 'Error al limpiar el historial.'
    });
  }
};

module.exports = {
  processAiChat,
  getChatHistory,
  clearChatHistory
};