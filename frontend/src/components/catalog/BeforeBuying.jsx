export default function BeforeBuying() {
  return (
    <section className="before-buying" aria-label="Antes de comprar">
      <h2>Antes de comprar</h2>
      <details>
        <summary>¿Cómo confirmo mi pedido?</summary>
        <p>
          Envía el mensaje que prepara TechStore. La tienda te confirmará los detalles por WhatsApp.
        </p>
      </details>
      <details>
        <summary>¿Cuándo se confirma el pago?</summary>
        <p>El pedido queda pendiente hasta que la tienda verifique el pago.</p>
      </details>
      <details>
        <summary>¿Qué hago si necesito cancelar o pedir garantía?</summary>
        <p>
          Si el pedido todavía admite cancelación, puedes hacerlo desde su seguimiento. Si el pago
          ya se confirmó o necesitas ayuda con una garantía, contacta con la tienda por WhatsApp.
        </p>
      </details>
    </section>
  );
}
