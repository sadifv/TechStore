import { useRef } from 'react';
import { categories } from '../../config/storeCatalog.js';

export default function HomeCategoryGallery() {
  const gallery = useRef(null);

  function scroll(direction) {
    const list = gallery.current;
    list.scrollBy({ left: direction * list.clientWidth * 0.8 });
  }

  return (
    <section className="products-section editorial-section" aria-labelledby="categories-heading">
      <header className="editorial-heading">
        <p className="editorial-kicker">01 / Explora la tienda</p>
        <h2 id="categories-heading">Tecnología por categorías</h2>
        <p>Desliza o usa las flechas para explorar.</p>
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
        {categories.map((category, index) => (
          <li key={category}>
            <a href={`/catalogo?category=${encodeURIComponent(category)}`}>
              <span className="editorial-kicker">{String(index + 1).padStart(2, '0')}</span>
              <strong>{category}</strong>
              <span aria-hidden="true">↗</span>
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}
