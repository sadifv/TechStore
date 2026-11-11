import { backendAssetUrl } from '../../services/api.js';
import { placeholder } from '../../config/storeCatalog.js';

export default function AssistantProductLink({ product }) {
  return (
    <a className="techbot-example-product" href={`/producto/${product._id}`}>
      <img src={backendAssetUrl(product.image || placeholder)} alt="" loading="lazy" />
      <span>
        <strong>{product.name}</strong>
        <span className="product-price">
          {new Intl.NumberFormat('es-EC', { style: 'currency', currency: 'USD' }).format(
            product.price,
          )}
        </span>
        <span>{product.availableStock > 0 ? 'Disponible' : 'Agotado'}</span>
        <span className="techbot-product-action">Ver producto <span aria-hidden="true">↗</span></span>
      </span>
    </a>
  );
}
