import { useRef, useState } from 'react';
import { backendAssetUrl } from '../../services/api.js';
import { placeholder } from '../../config/storeCatalog.js';

export default function ProductGallery({ product, onSale }) {
  const images = [...new Set([product.image || placeholder, ...(product.gallery || [])])];
  const [index, setIndex] = useState(0);
  const dialog = useRef(null);
  const source = backendAssetUrl(images[index] || images[0]);
  return (
    <section className="detail-gallery" aria-label="Fotos del producto">
      <figure className="product-detail-media">
        <button
          type="button"
          className="gallery-image-button"
          onClick={() => dialog.current.showModal()}
          aria-label="Ampliar foto"
        >
          <img src={source} alt={product.name} />
        </button>
        {onSale && <span className="product-detail-discount">-{product.flashSaleDiscount}%</span>}
      </figure>
      {images.length > 1 && (
        <ul className="featured-thumbnails" aria-label="Elegir foto">
          {images.map((image, number) => (
            <li key={image}>
              <button
                type="button"
                aria-current={index === number ? 'true' : undefined}
                aria-label={`Ver foto ${number + 1}`}
                onClick={() => setIndex(number)}
              >
                <img src={backendAssetUrl(image)} alt="" loading="lazy" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <dialog
        ref={dialog}
        className="gallery-dialog"
        aria-label={`Foto ampliada de ${product.name}`}
      >
        <form method="dialog">
          <button className="btn btn-outline">Cerrar foto</button>
        </form>
        <img src={source} alt={product.name} loading="lazy" />
      </dialog>
    </section>
  );
}
