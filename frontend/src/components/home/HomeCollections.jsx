import { useEffect, useRef, useState } from 'react';
import { requestJson } from '../../services/api.js';
import { storeCollections } from '../../config/storeCollections.js';
import ProductCard from '../catalog/ProductCard.jsx';

export default function HomeCollections() {
  const sectionRef = useRef(null);
  const [nearby, setNearby] = useState(
    () => typeof window === 'undefined' || !('IntersectionObserver' in window),
  );
  const [groups, setGroups] = useState({});
  const [selected, setSelected] = useState('');
  useEffect(() => {
    if (nearby || !sectionRef.current) return undefined;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        setNearby(true);
        observer.disconnect();
      },
      { rootMargin: '400px' },
    );
    observer.observe(sectionRef.current);
    return () => observer.disconnect();
  }, [nearby]);
  useEffect(() => {
    if (!nearby) return undefined;
    const controller = new AbortController();
    requestJson('/api/store/collections', { signal: controller.signal })
      .then((result) => {
        if (!controller.signal.aborted) setGroups(result.collections || {});
      })
      .catch(() => {});
    return () => controller.abort();
  }, [nearby]);
  const visible = storeCollections.filter(([key]) => groups[key]?.length);
  if (!visible.length) return <div ref={sectionRef} className="home-collections-slot" />;
  const active = visible.find(([key]) => key === selected) || visible[0];
  return (
    <section
      className="products-section editorial-section home-collections"
      aria-labelledby="collection-heading"
    >
      <h2 id="collection-heading">Colecciones TechStore</h2>
      <nav className="editorial-controls collection-controls" aria-label="Elegir colección">
        {visible.map(([key, title]) => (
          <button
            key={key}
            type="button"
            aria-pressed={active[0] === key}
            onClick={() => setSelected(key)}
          >
            {title}
          </button>
        ))}
      </nav>
      <h3>{active[1]}</h3>
      <ul className="products-grid">
        {groups[active[0]].map((product) => (
          <ProductCard key={product._id} product={product} />
        ))}
      </ul>
    </section>
  );
}
