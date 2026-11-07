import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { requestJson } from '../services/api.js';
const HomeBelowFold = lazy(() => import('../components/home/HomeBelowFold.jsx'));
import FlashSaleSection from '../components/home/FlashSaleSection.jsx';
import HeroSection from '../components/home/HeroSection.jsx';
import HomeCollections from '../components/home/HomeCollections.jsx';
import HomeCategoryGallery from '../components/home/HomeCategoryGallery.jsx';
import ProductCard from '../components/catalog/ProductCard.jsx';
import { backendAssetUrl } from '../services/api.js';
import { placeholder } from '../config/storeCatalog.js';
import { normalizeHomeProducts } from './homeProducts.js';

function DeferredHomeContent({ user }) {
  const sectionRef = useRef(null);
  const [visible, setVisible] = useState(
    () =>
      typeof window === 'undefined' ||
      !('IntersectionObserver' in window) ||
      ['#ai-assistant', '#contacto'].includes(window.location.hash),
  );

  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return undefined;
    const loadForAnchor = () => {
      if (['#ai-assistant', '#contacto'].includes(window.location.hash)) setVisible(true);
    };
    window.addEventListener('hashchange', loadForAnchor);
    if (!('IntersectionObserver' in window))
      return () => window.removeEventListener('hashchange', loadForAnchor);
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        setVisible(true);
        observer.disconnect();
      },
      { rootMargin: '400px' },
    );
    observer.observe(section);
    return () => {
      observer.disconnect();
      window.removeEventListener('hashchange', loadForAnchor);
    };
  }, []);

  if (visible) {
    return (
      <Suspense
        fallback={
          <section id="ai-assistant" className="ai-section" aria-busy="true">
            <h2>Asistente TechBot</h2>
            <p role="status">Cargando el asistente…</p>
          </section>
        }
      >
        <HomeBelowFold user={user} />
      </Suspense>
    );
  }

  return (
    <section
      ref={sectionRef}
      id="ai-assistant"
      className="ai-section"
      aria-labelledby="ai-assistant-placeholder-title"
    >
      <h2 id="ai-assistant-placeholder-title">Asistente TechBot</h2>
      <p>¿Tienes dudas? TechBot puede ayudarte a encontrar el producto ideal.</p>
    </section>
  );
}

export default function HomePage({ user }) {
  const [products, setProducts] = useState([]);
  const [flashSale, setFlashSale] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [featuredIndex, setFeaturedIndex] = useState(0);

  useEffect(() => {
    let active = true;
    requestJson('/api/products/home')
      .then((result) => {
        if (!active) return;
        const homeCatalog = normalizeHomeProducts(result);
        setProducts(homeCatalog.products);
        setFlashSale(homeCatalog.flashSale);
        setError('');
      })
      .catch((requestError) => {
        if (active) setError(requestError.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  return (
    <>
      <HeroSection />
      <HomeCategoryGallery />
      <FlashSaleSection product={flashSale} />
      <section
        id="destacados"
        className="products-section editorial-section"
        aria-labelledby="featured-heading"
      >
        <header className="section-header">
          <div>
            <p className="editorial-kicker">02 / Selección TechStore</p>
            <h2 id="featured-heading">Encuentra tu siguiente favorito</h2>
            <p className="section-note">Tecnología que encaja contigo y con tu día.</p>
          </div>
          <a className="section-view-all" href="/catalogo">
            Ver catálogo <span aria-hidden="true">↗</span>
          </a>
        </header>
        {products.length > 1 && (
          <nav className="editorial-controls" aria-label="Navegar productos destacados">
            <button
              type="button"
              aria-label="Producto destacado anterior"
              aria-controls="featured-grid"
              disabled={featuredIndex === 0}
              onClick={() => setFeaturedIndex(featuredIndex - 1)}
            >
              ←
            </button>
            <span role="status">
              {String(featuredIndex + 1).padStart(2, '0')} /{' '}
              {String(products.length).padStart(2, '0')}
            </span>
            <button
              type="button"
              aria-label="Producto destacado siguiente"
              aria-controls="featured-grid"
              disabled={featuredIndex === products.length - 1}
              onClick={() => setFeaturedIndex(featuredIndex + 1)}
            >
              →
            </button>
          </nav>
        )}
        <ul id="featured-grid" className="editorial-featured" aria-live="polite">
          {loading ? (
            <li className="empty-state-item">
              <p className="empty-msg">Cargando productos...</p>
            </li>
          ) : error ? (
            <li className="empty-state-item">
              <p className="empty-msg">{error}</p>
            </li>
          ) : products.length ? (
            <ProductCard
              key={products[featuredIndex]._id}
              product={products[featuredIndex]}
              featured
            />
          ) : (
            <li className="empty-state-item">
              <p className="empty-msg">No hay productos destacados disponibles en este momento.</p>
            </li>
          )}
        </ul>
        {products.length > 1 && (
          <ul className="featured-thumbnails" aria-label="Elegir producto destacado">
            {products.map((product, index) => (
              <li key={product._id}>
                <button
                  type="button"
                  aria-label={product.name}
                  aria-current={index === featuredIndex ? 'true' : undefined}
                  aria-controls="featured-grid"
                  onClick={() => setFeaturedIndex(index)}
                >
                  <img src={backendAssetUrl(product.image || placeholder)} alt="" loading="lazy" />
                  <span aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
      <HomeCollections />
      <DeferredHomeContent user={user} />
    </>
  );
}
