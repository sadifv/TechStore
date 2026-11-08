import { useRef, useState } from 'react';
import { backendAssetUrl } from '../../services/api.js';
import { placeholder } from '../../config/storeCatalog.js';

export default function ProductGallery({ product, onSale }) {
  const images = [...new Set([product.image || placeholder, ...(product.gallery || [])])];
  const [index, setIndex] = useState(0);
  const dialog = useRef(null);
  const source = backendAssetUrl(images[index] || images[0]);
  const changePhoto = (step) =>
    setIndex((current) => (current + step + images.length) % images.length);
  return (
    <section className="detail-gallery" aria-label="Fotos del producto">
      <figure className="product-detail-media">
        <button
          type="button"
          className="gallery-image-button"
          onClick={() => dialog.current.showModal()}
          aria-label="Ampliar foto"
        >
          <img src={source} alt={product.name} referrerPolicy="no-referrer" />
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
                <img
                  src={backendAssetUrl(image)}
                  alt=""
                  loading="lazy"
                  referrerPolicy="no-referrer"
                />
              </button>
            </li>
          ))}
        </ul>
      )}
      <dialog
        ref={dialog}
        className="gallery-dialog"
        aria-label={`Foto ampliada de ${product.name}`}
        onKeyDown={(event) => {
          if (images.length < 2 || !['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
          event.preventDefault();
          changePhoto(event.key === 'ArrowLeft' ? -1 : 1);
        }}
      >
        <header className="gallery-toolbar">
          <p role="status" aria-label="Foto actual">
            {String(index + 1).padStart(2, '0')} / {String(images.length).padStart(2, '0')}
          </p>
          <form method="dialog">
            <button className="btn btn-outline" aria-label="Cerrar foto">
              ×
            </button>
          </form>
        </header>
        <img src={source} alt={product.name} loading="lazy" referrerPolicy="no-referrer" />
        {images.length > 1 && (
          <nav className="gallery-navigation" aria-label="Recorrer fotos ampliadas">
            <button className="btn btn-outline" type="button" onClick={() => changePhoto(-1)}>
              ← Anterior
            </button>
            <button className="btn btn-outline" type="button" onClick={() => changePhoto(1)}>
              Siguiente →
            </button>
          </nav>
        )}
      </dialog>
    </section>
  );
}
