import { productImageSources } from '../../services/productImages.js';

export default function BuildKitPreview({ slots }) {
  return (
    <section className="build-kit-preview" aria-label="Vista de tu selección">
      <span className="build-preview-orbit" aria-hidden="true" />
      <ul>
        {slots.map(({ label, product }, index) => (
          <li key={label} data-filled={Boolean(product)}>
            <span className="build-preview-index" aria-hidden="true">
              0{index + 1}
            </span>
            {product ? (
              <img
                key={product._id}
                {...productImageSources(product.image)}
                width={80}
                height={72}
                alt={product.name}
              />
            ) : (
              <span className="build-preview-placeholder" aria-hidden="true">
                +
              </span>
            )}
            <span>{label}</span>
          </li>
        ))}
      </ul>
      <p>Vista de selección · no certifica compatibilidad.</p>
    </section>
  );
}
