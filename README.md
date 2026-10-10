# 🛒 TechStore - Dropshipping E-Commerce & Admin Panel

TechStore es una plataforma e-commerce full-stack moderna y accesible orientada al comercio electrónico y dropshipping. Incluye catálogo dinámico con filtros, ofertas relámpago con temporizador (*Flash Sales*), asistente virtual interactivo potenciado por IA (OpenAI), gestión de carrito persistente y panel de administración para control de catálogo y pedidos.

---

## 🛠️ Tecnologías Utilizadas

- **Backend:** Node.js, Express.js, EJS (Motor de plantillas con `express-ejs-layouts`).
- **Base de Datos:** MongoDB con Mongoose y sesiones persistentes vía `connect-mongo`.
- **Seguridad & Middleware:** Helmet, CORS, Express Rate Limit, Express Slow Down, Express Validator, Bcryptjs.
- **Integraciones:** Stripe API (Checkout y Webhooks), OpenAI API (Asistente TechBot), Winston (Logging estructurado).
- **Frontend:** Semantic HTML5, CSS Variables, JavaScript vanilla asíncrono (`fetch`), Remix Icon.

---

## 📋 Requisitos Previos

Asegúrate de tener instalado en tu sistema:
- **Node.js** (v18.0.0 o superior)
- **npm** (v9.0.0 o superior)
- **MongoDB** (Instancia local corriendo en `mongodb://127.0.0.1:27017/` o URI de MongoDB Atlas)

---

## 🚀 Instalación y Puesta en Marcha

1. **Clonar el repositorio:**
   ```bash
   git clone [https://github.com/tu-usuario/techstore.git](https://github.com/tu-usuario/techstore.git)
   cd techstore