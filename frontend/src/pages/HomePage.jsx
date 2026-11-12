import { lazy, Suspense, useEffect, useState } from 'react';
import { requestJson } from '../services/api.js';
import FlashSaleSection from '../components/home/FlashSaleSection.jsx';
import HeroSection from '../components/home/HeroSection.jsx';
import HomeCollections from '../components/home/HomeCollections.jsx';
import HomeCategoryGallery from '../components/home/HomeCategoryGallery.jsx';
import ProductCard from '../components/catalog/ProductCard.jsx';
import { normalizeHomeProducts } from './homeProducts.js';

const HomeBelowFold = lazy(() => import('../components/home/HomeBelowFold.jsx'));

export default function HomePage({ user }) {
  const [products, setProducts] = useState([]);
  const [categoryImages, setCategoryImages] = useState([]);
  const [flashSale, setFlashSale] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    requestJson('/api/products/home')
      .then((result) => {
        if (!active) return;
        const homeCatalog = normalizeHomeProducts(result);
        setProducts(homeCatalog.products);
        setCategoryImages(Array.isArray(result?.categoryImages) ? result.categoryImages : []);
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
      <HeroSection signedIn={Boolean(user)} />
      <div className="home-storefront">
        <section
          id="destacados"
          className="products-section editorial-section"
          aria-labelledby="featured-heading"
        >
          <header className="section-header">
            <h2 id="featured-heading">Productos destacados</h2>
            <a className="section-view-all" href="/catalogo">
              Ver catálogo <span aria-hidden="true">↗</span>
            </a>
          </header>
          <ul id="featured-grid" className="products-grid" aria-live="polite">
            {loading ? (
              <li className="empty-state-item">
                <p className="empty-msg">Cargando productos…</p>
              </li>
            ) : error ? (
              <li className="empty-state-item">
                <p className="empty-msg">{error}</p>
              </li>
            ) : products.length ? (
              products
                .slice(0, 4)
                .map((product) => <ProductCard key={product._id} product={product} />)
            ) : (
              <li className="empty-state-item">
                <p className="empty-msg">No hay destacados con stock en este momento.</p>
              </li>
            )}
          </ul>
        </section>
        <HomeCategoryGallery categoryImages={categoryImages} />
        <FlashSaleSection product={flashSale} />
        <HomeCollections />
        <Suspense
          fallback={
            <section className="home-content-loading" aria-busy="true">
              <p role="status">Cargando las secciones de la tienda…</p>
            </section>
          }
        >
          <HomeBelowFold user={user} />
        </Suspense>
      </div>
    </>
  );
}
