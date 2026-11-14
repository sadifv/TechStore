import { useRef } from 'react';
import useStoreCategories from '../../hooks/useStoreCategories.js';
import { placeholder } from '../../config/storeCatalog.js';
import { productImageSources } from '../../services/productImages.js';

const categoryReferences = {
  Audio: '/images/products/shure-sm7b-ref.jpg',
  Periféricos: '/images/products/logitech-brio-4k-ref.jpg',
  Monitores: '/images/products/lg-ultragear-27-ref.jpg',
  Componentes: '/images/products/ryzen-5-5600-ref.jpg',
  'Cocina y hogar': '/images/products/cafetera-filtro-ref.jpg',
};

export default function HomeCategoryGallery({ categoryImages = [] }) {
  const { categories } = useStoreCategories();
  const gallery = useRef(null);

  function scroll(direction) {
    const list = gallery.current;
    list.scrollBy({ left: direction * list.clientWidth * 0.8 });
  }

  return (
    <section className="products-section editorial-section" aria-labelledby="categories-heading">
      <header className="editorial-heading">
        <h2 id="categories-heading">Compra por categoría</h2>
        <nav className="editorial-controls" aria-label="Controles de categorías">
          <button
            type="button"
            aria-label="Desplazar categorías hacia atrás"
            aria-controls="home-categories"
            onClick={() => scroll(-1)}
          >
            ←
          </button>
          <button
            type="button"
            aria-label="Desplazar categorías hacia adelante"
            aria-controls="home-categories"
            onClick={() => scroll(1)}
          >
            →
          </button>
        </nav>
      </header>
      <ul id="home-categories" className="editorial-category-list" ref={gallery}>
        {categories.map(({ id, name: category, image: categoryImage }) => {
          const image =
            categoryImage ||
            categoryImages.find((item) => item._id === category)?.image ||
            categoryReferences[category] ||
            placeholder;
          return (
            <li key={id}>
              <a href={`/catalogo?category=${encodeURIComponent(category)}`}>
                {image && (
                  <img
                    {...productImageSources(image)}
                    sizes="(min-width: 768px) 25vw, 75vw"
                    alt=""
                    loading="lazy"
                  />
                )}
                <strong>{category}</strong>
                <span aria-hidden="true">↗</span>
              </a>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
