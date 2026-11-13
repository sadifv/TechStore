import { useEffect, useRef, useState } from 'react';
import { requestJson } from '../../services/api.js';
import ProductCard from '../catalog/ProductCard.jsx';
import ProductComparison from '../catalog/ProductComparison.jsx';

export default function GuidedShopping() {
  const [category, setCategory] = useState('any');
  const [use, setUse] = useState('estudiar');
  const [budget, setBudget] = useState('');
  const [products, setProducts] = useState(null);
  const [comparison, setComparison] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const controller = useRef(null);
  const results = useRef(null);
  useEffect(() => () => controller.current?.abort(), []);

  async function findProducts(event) {
    event.preventDefault();
    controller.current?.abort();
    const current = new AbortController();
    controller.current = current;
    setBusy(true);
    setError('');
    setProducts(null);
    setComparison([]);
    try {
      const result = await requestJson('/api/ai/recommendations', {
        method: 'POST',
        signal: current.signal,
        body: JSON.stringify({ category, use, budget: budget === '' ? null : Number(budget) }),
      });
      if (!current.signal.aborted) {
        setProducts(result.products);
        requestAnimationFrame(() => results.current?.focus());
      }
    } catch (requestError) {
      if (!current.signal.aborted) setError(requestError.message);
    } finally {
      if (!current.signal.aborted) setBusy(false);
    }
  }
  function editAnswers() {
    controller.current?.abort();
    setBusy(false);
    setProducts(null);
    setComparison([]);
    setError('');
  }
  function toggle(product) {
    setComparison((current) =>
      current.some((item) => item._id === product._id)
        ? current.filter((item) => item._id !== product._id)
        : current.length < 3 && (!current.length || current[0].category === product.category)
          ? [...current, product]
          : current,
    );
  }
  return (
    <section className="guided-shopping" aria-labelledby="guided-shopping-title">
      <header>
        <h3 id="guided-shopping-title">Encuentra opciones para ti</h3>
        <p>Elige qué buscas, para qué lo necesitas y cuánto quieres gastar.</p>
      </header>
      <form onSubmit={findProducts} className="guided-shopping-form">
        <label htmlFor="guided-category">
          ¿Qué buscas?
          <select
            id="guided-category"
            aria-label="¿Qué buscas?"
            value={category}
            onChange={(event) => {
              editAnswers();
              setCategory(event.target.value);
            }}
          >
            <option value="any">No estoy seguro</option>
            {['Laptops', 'Audio', 'Periféricos'].map((value) => (
              <option key={value}>{value}</option>
            ))}
          </select>
        </label>
        <label htmlFor="guided-use">
          ¿Para qué lo necesitas?
          <select
            id="guided-use"
            aria-label="¿Para qué lo necesitas?"
            value={use}
            onChange={(event) => {
              editAnswers();
              setUse(event.target.value);
            }}
          >
            <option value="estudiar">Estudiar</option>
            <option value="trabajar">Trabajar</option>
            <option value="jugar">Jugar</option>
            <option value="videollamadas">Videollamadas</option>
            <option value="musica">Escuchar música</option>
          </select>
        </label>
        <label>
          Presupuesto máximo en USD (opcional)
          <input
            type="number"
            min="0.01"
            max="100000"
            step="0.01"
            inputMode="decimal"
            value={budget}
            onChange={(event) => {
              editAnswers();
              setBudget(event.target.value);
            }}
            placeholder="Sin límite"
          />
        </label>
        <button type="submit" className="btn btn-primary" disabled={busy}>
          {busy ? 'Buscando opciones…' : 'Buscar opciones'}
        </button>
      </form>
      <p>
        Orientación basada en datos del catálogo, sin garantizar rendimiento ni compatibilidad.
        Consultar no reserva stock.
      </p>
      {error && (
        <p className="form-status error" role="alert">
          {error}
        </p>
      )}
      {products !== null && (
        <section ref={results} tabIndex={-1} aria-label="Resultados de compra guiada">
          <p role="status">
            {products.length
              ? `${products.length} opciones disponibles al consultar.`
              : 'No hay opciones disponibles dentro de esos criterios. Cambia la categoría o el presupuesto.'}
          </p>
          {comparison.length > 0 && (
            <ProductComparison products={comparison} clear={() => setComparison([])} />
          )}
          <ul className="guided-shopping-products">
            {products.map((product) => (
              <li key={product._id}>
                <ul
                  className="guided-shopping-reasons"
                  aria-label={`Por qué aparece ${product.name}`}
                >
                  {product.reasons.map((reason, index) => (
                    <li key={index}>{reason}</li>
                  ))}
                </ul>
                <ul className="guided-shopping-card">
                  <ProductCard
                    product={product}
                    comparison={{
                      selected: comparison.some((item) => item._id === product._id),
                      disabled: Boolean(
                        comparison.length && comparison[0].category !== product.category,
                      ),
                      toggle,
                    }}
                  />
                </ul>
              </li>
            ))}
          </ul>
        </section>
      )}
    </section>
  );
}
