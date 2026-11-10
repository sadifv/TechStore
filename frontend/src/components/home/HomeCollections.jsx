import { useEffect, useState } from 'react';
import { requestJson } from '../../services/api.js';
import { storeCollections } from '../../config/storeCollections.js';
import ProductCard from '../catalog/ProductCard.jsx';

export default function HomeCollections() {
  const [groups, setGroups] = useState({});
  const [selected, setSelected] = useState('');
  useEffect(() => {
    const controller = new AbortController();
    requestJson('/api/store/collections', { signal: controller.signal })
      .then((result) => setGroups(result.collections || {}))
      .catch(() => {});
    return () => controller.abort();
  }, []);
  const visible = storeCollections.filter(([key]) => groups[key]?.length);
  if (!visible.length) return null;
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
