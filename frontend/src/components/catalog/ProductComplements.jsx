import { useEffect, useId, useState } from 'react';
import { requestJson } from '../../services/api.js';
import { money } from '../../utils/formatters.js';
import { useCartActions, useCartState } from '../cart/CartContext.js';

const keyboard = 'Teclado Mecánico Keychron K2';
const mouse = 'Mouse Logitech MX Master 3S';
const camera = 'Cámara Web Logitech Brio 4K';
const microphone = 'Micrófono Shure SM7B';
const recommendations = new Map([
  [
    "Monitor LG UltraGear 27'' 144Hz",
    [
      [keyboard, 'Completa tu escritorio con un teclado.'],
      [mouse, 'Añade un ratón para usar el equipo en el escritorio.'],
    ],
  ],
  [camera, [[microphone, 'Considera un micrófono dedicado para tus transmisiones.']]],
  [keyboard, [[mouse, 'Acompaña el teclado con un ratón de escritorio.']]],
  [mouse, [[keyboard, 'Completa la selección con un teclado de escritorio.']]],
]);

export function GuestCartComplements({ items }) {
  const ids = items
    .map(({ id }) => id)
    .filter((id) => /^[a-f\d]{24}$/i.test(id))
    .join(',');
  return ids ? <GuestComplementLookup key={ids} ids={ids} /> : null;
}

function GuestComplementLookup({ ids }) {
  const [anchors, setAnchors] = useState([]);

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      const productIds = ids.split(',');
      const results = [];
      for (let offset = 0; offset < productIds.length; offset += 30) {
        const query = new URLSearchParams({ ids: productIds.slice(offset, offset + 30).join(',') });
        const result = await requestJson(`/api/products/complement-anchors?${query}`, {
          signal: controller.signal,
        });
        results.push(...result.data);
        if (controller.signal.aborted) return;
      }
      const order = new Map(productIds.map((id, index) => [id, index]));
      results.sort((first, second) => order.get(first._id) - order.get(second._id));
      setAnchors(results);
    }
    load().catch(() => {});
    return () => controller.abort();
  }, [ids]);

  return <ProductComplements anchors={anchors} />;
}

export default function ProductComplements({ anchors }) {
  const { items } = useCartState();
  const excludedIds = new Set([...anchors, ...items].map((item) => item._id || item.id));
  const excludedNames = new Set([...anchors, ...items].map((item) => item.name));
  const candidates = new Map(
    anchors.flatMap(({ name, complements }) =>
      Array.isArray(complements)
        ? complements
            .filter(({ productId }) => !excludedIds.has(productId))
            .map(({ productId }) => [productId, null])
        : (recommendations.get(name) ?? []).filter(([candidate]) => !excludedNames.has(candidate)),
    ),
  );
  const key = JSON.stringify([...candidates].slice(0, 3));
  if (!candidates.size) return null;
  return <ComplementResults key={key} candidates={key} />;
}

function ComplementResults({ candidates }) {
  const heading = useId();
  const { add, notify } = useCartActions();
  const [products, setProducts] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [picked, setPicked] = useState([]);

  useEffect(() => {
    const controller = new AbortController();
    Promise.allSettled(
      JSON.parse(candidates).map(async ([reference, reason]) => {
        const options = { signal: controller.signal };
        const query = new URLSearchParams({ search: reference, limit: '10' });
        const product = reason
          ? (await requestJson(`/api/products?${query}`, options)).products.find(
              (item) => item.name === reference,
            )
          : (await requestJson(`/api/products/${encodeURIComponent(reference)}`, options)).data;
        return (product?.availableStock ?? product?.stock ?? 0) > 0 ? { product, reason } : null;
      }),
    ).then((results) => {
      if (controller.signal.aborted) return;
      const distinct = new Map();
      for (const entry of results) {
        if (entry.status !== 'fulfilled' || !entry.value) continue;
        const id = String(entry.value.product._id);
        if (!distinct.has(id)) distinct.set(id, entry.value);
      }
      setProducts([...distinct.values()]);
    });
    return () => controller.abort();
  }, [candidates]);

  if (!products.length) return null;
  async function addPicked(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      for (const { product } of products) if (picked.includes(product._id)) await add(product, 1);
    } catch (failure) {
      setError(failure.message);
      notify(failure.message, 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="product-complements" aria-labelledby={heading}>
      <h3 id={heading}>Complementos disponibles</h3>
      <form onSubmit={addPicked}>
        <fieldset disabled={busy}>
          <legend className="sr-only">Elegir complementos</legend>
          {products.map(({ product, reason }) => (
            <label key={product._id}>
              <input
                type="checkbox"
                checked={picked.includes(product._id)}
                onChange={(event) => {
                  const checked = event.target.checked;
                  setPicked((current) =>
                    checked
                      ? [...current, product._id]
                      : current.filter((id) => id !== product._id),
                  );
                }}
              />
              <span>
                <strong>{product.name}</strong> · {money(product.price)}
                {reason && <small>{reason}</small>}
              </span>
            </label>
          ))}
        </fieldset>
        <button type="submit" className="btn btn-secondary" disabled={busy || !picked.length}>
          {busy ? 'Añadiendo…' : 'Añadir complementos seleccionados'}
        </button>
        {error && <p role="alert">{error}</p>}
      </form>
    </section>
  );
}
