// controllers/aiController.js

// @desc    Procesar consultas del asistente de IA
// @route   POST /api/ai/chat
// @access  Public
const processAiChat = async (req, res) => {
    try {
        const { message } = req.body;

        if (!message || message.trim() === '') {
            return res.status(400).json({
                success: false,
                error: 'El mensaje no puede estar vacío.'
            });
        }

        // Contexto base para el asistente de TechStore
        const systemPrompt = "Eres un asistente virtual de TechStore, una tienda e-commerce de tecnología. Responde de forma amable, breve y orienta al usuario con sus compras de gadgets y laptops.";

        // TODO: Integrar aquí la llamada a la API del modelo de lenguaje usando process.env.AI_API_KEY
        // Ejemplo de respuesta mock/simulada hasta configurar la API key:
        const aiReply = `Hola! Soy el asistente de TechStore. Entiendo tu consulta sobre "${message}". ¿En qué categoría de productos te gustaría buscar hoy?`;

        res.status(200).json({
            success: true,
            reply: aiReply
        });

    } catch (error) {
        console.error('Error en aiController:', error);
        res.status(500).json({
            success: false,
            error: 'Ocurrió un error al procesar la respuesta del asistente.'
        });
    }
};

module.exports = {
    processAiChat
};