export function LegalPage() {
  return (
    <article className="legal-container" aria-labelledby="legal-heading">
      <h1 id="legal-heading">Información Legal</h1>
      <section id="privacidad">
        <h2>Política de Privacidad</h2>
        <p>Última actualización: Octubre 2026</p>
        <p>
          En TechStore, valoramos tu privacidad. Esta política describe cómo recopilamos, usamos y
          protegemos tu información personal.
        </p>
        <h3>Información que recopilamos</h3>
        <ul>
          <li>Nombre y correo electrónico al registrarte</li>
          <li>Dirección de envío para procesar pedidos</li>
          <li>Historial de compras y preferencias</li>
          <li>Preferencias de membresía y consentimiento para comunicaciones promocionales</li>
        </ul>
        <h3>Cómo usamos tu información</h3>
        <ul>
          <li>Procesar y enviar tus pedidos</li>
          <li>Enviar confirmaciones y actualizaciones por correo</li>
          <li>Enviar campañas promocionales solo a quienes aceptaron recibirlas</li>
          <li>Mejorar nuestros productos y servicios</li>
        </ul>
        <p>
          Puedes darte de baja de campañas desde el enlace incluido en cada correo. La baja no
          afecta los mensajes transaccionales de tus pedidos ni el estado de una membresía activa.
        </p>
        <h3>Protección de datos</h3>
        <p>
          Implementamos medidas de seguridad para proteger tu información personal contra acceso no
          autorizado, alteración o destrucción.
        </p>
      </section>
      <section id="terminos">
        <h2>Términos y Condiciones</h2>
        <p>Última actualización: Octubre 2026</p>
        <h3>Uso del servicio</h3>
        <p>
          Al usar TechStore, aceptas estos términos. Debes tener al menos 18 años para realizar
          compras.
        </p>
        <h3>Productos y precios</h3>
        <p>
          Nos esforzamos por mostrar información precisa, pero pueden existir errores. Nos
          reservamos el derecho de corregir precios y descripciones.
        </p>
        <h3>Membresía VIP y cupones</h3>
        <p>
          El precio y las condiciones de los cupones se muestran en{' '}
          <a href="/vip">la página de membresía</a> y pueden cambiar para nuevas altas. Cuando se
          ofrece con Stripe, la membresía se factura mensualmente con renovación automática hasta
          que la canceles; conserva el acceso hasta terminar el período pagado. Puedes cancelar
          desde tu cuenta y administrar tu método de pago en el portal de Stripe. Los cupones están
          sujetos a su compra mínima, tope, vencimiento y límite de usos; se validan al momento del
          checkout. La baja de comunicaciones promocionales no cancela la membresía.
        </p>
        <p>
          La modalidad simulada solo existe en desarrollo, no solicita tarjeta ni genera cobros, y
          no se renueva automáticamente. No se activarán altas simuladas en producción.
        </p>
        <h3>Envíos y entregas</h3>
        <p>
          Los tiempos de entrega son estimados y pueden variar según la ubicación y disponibilidad
          del producto.
        </p>
        <h3>Devoluciones</h3>
        <p>
          Aceptamos devoluciones dentro de los 14 días posteriores a la entrega, siempre que el
          producto esté en su estado original.
        </p>
      </section>
      <section id="cookies">
        <h2>Política de Cookies</h2>
        <p>Última actualización: Octubre 2026</p>
        <p>
          Utilizamos cookies para mejorar tu experiencia de navegación y analizar el tráfico del
          sitio.
        </p>
        <h3>Tipos de cookies que usamos</h3>
        <ul>
          <li>
            <strong>Cookies esenciales:</strong> Necesarias para el funcionamiento del sitio
            (sesiones, carrito)
          </li>
          <li>
            <strong>Cookies de análisis:</strong> Nos ayudan a entender cómo usas el sitio
          </li>
        </ul>
        <h3>Gestión de cookies</h3>
        <p>
          Puedes configurar tu navegador para rechazar cookies, pero algunas funciones del sitio
          pueden no funcionar correctamente.
        </p>
      </section>
    </article>
  );
}
