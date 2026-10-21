import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { requestJson } from '../api.js';
const HomeBelowFold = lazy(() => import('../components/HomeBelowFold.jsx'));
import FlashSaleSection from '../components/FlashSaleSection.jsx';
import HeroSection from '../components/HeroSection.jsx';
import ProductCard from '../components/ProductCard.jsx';

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

  useEffect(() => {
    let active = true;
    requestJson('/api/products?limit=100&sort=recent')
      .then((result) => {
        if (!active) return;
        const allProducts = result.products || [];
        setProducts(allProducts.slice(0, 8));
        const now = Date.now();
        const activeSales = allProducts
          .filter(
            (product) => product.flashSale && new Date(product.flashSaleEndsAt).getTime() > now,
          )
          .sort((a, b) => new Date(a.flashSaleEndsAt) - new Date(b.flashSaleEndsAt));
        setFlashSale(activeSales[0] || null);
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
      <FlashSaleSection product={flashSale} />
      <section id="destacados" className="products-section" aria-labelledby="featured-heading">
        <header className="section-header">
          <h2 id="featured-heading">Productos Destacados</h2>
        </header>
        <ul id="featured-grid" className="products-grid" aria-live="polite">
          {loading ? (
            <li className="empty-state-item">
              <p className="empty-msg">Cargando productos...</p>
            </li>
          ) : error ? (
            <li className="empty-state-item">
              <p className="empty-msg">{error}</p>
            </li>
          ) : products.length ? (
            products.map((product) => <ProductCard key={product._id} product={product} />)
          ) : (
            <li className="empty-state-item">
              <p className="empty-msg">No hay productos destacados disponibles en este momento.</p>
            </li>
          )}
        </ul>
      </section>
      <DeferredHomeContent user={user} />
    </>
  );
}
