import { useEffect, useState } from 'react';
import { backendAssetUrl, requestJson } from '../services/api.js';
import { placeholder } from '../config/storeCatalog.js';
import { useCartActions } from '../components/cart/CartContext.js';

const kits = {
  pc: ['Arma la base de tu PC'],
  coffee: [
    'Rincón de café',
    'Cafetera de filtro',
    'Hervidor eléctrico',
    'Balanza digital de cocina',
  ],
  kitchen: ['Cocina práctica', 'Freidora de aire', 'Licuadora de vaso', 'Batidora de mano'],
  desk: [
    'Escritorio',
    "Monitor LG UltraGear 27'' 144Hz",
    'Teclado Mecánico Keychron K2',
    'Mouse Logitech MX Master 3S',
  ],
  streaming: [
    'Streaming',
    'Cámara Web Logitech Brio 4K',
    'Micrófono Shure SM7B',
    'Auriculares Sony WH-1000XM5',
  ],
};

const platforms = {
  AM4: [
    ['Procesador AMD Ryzen 5 5600', 'Procesador AMD Ryzen 7 5700X'],
    ['Placa madre B550 micro ATX', 'Placa madre B550 ATX'],
    ['Kit RAM DDR4 16 GB', 'Kit RAM DDR4 32 GB'],
  ],
  AM5: [
    ['Procesador AMD Ryzen 5 7600', 'Procesador AMD Ryzen 7 7700'],
    ['Placa madre B650 micro ATX', 'Placa madre B650 ATX'],
    ['Kit RAM DDR5 16 GB', 'Kit RAM DDR5 32 GB'],
  ],
};

const stock = (product) => product.availableStock ?? product.stock ?? 0;
const price = (value) =>
  new Intl.NumberFormat('es-EC', { style: 'currency', currency: 'USD' }).format(value);

export default function BuildKitPage() {
  const { add } = useCartActions();
  const [products, setProducts] = useState(null);
  const [kit, setKit] = useState('pc');
  const [platform, setPlatform] = useState('AM4');
  const [selected, setSelected] = useState([]);
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      const getPage = (page) =>
        requestJson(`/api/products?limit=100&page=${page}`, { signal: controller.signal });
      const first = await getPage(1);
      const rest = await Promise.all(
        Array.from({ length: (first.pagination?.totalPages ?? 1) - 1 }, (_, i) => getPage(i + 2)),
      );
      if (!controller.signal.aborted) {
        setProducts(
          new Map([first, ...rest].flatMap(({ products }) => products.map((p) => [p.name, p]))),
        );
      }
    }
    load().catch((error) => {
      if (!controller.signal.aborted) setLoadError(error.message);
    });
    return () => controller.abort();
  }, []);

  function resetSelection() {
    setSelected([]);
    setStatus('');
  }

  const chosen = selected.map((name) => products?.get(name)).filter(Boolean);
  const subtotal = chosen.reduce((total, item) => total + Number(item.price), 0);
  const hasSoldOut = chosen.some((product) => stock(product) < 1);
  const blockedReason = hasSoldOut
    ? 'Tu selección incluye productos agotados.'
    : kit === 'pc'
      ? 'La compra se habilitará cuando se confirme la compatibilidad de las placas y su BIOS.'
      : !chosen.length
        ? 'Selecciona al menos un producto disponible.'
        : '';

  async function addKit() {
    setBusy(true);
    const added = [];
    try {
      for (const product of chosen) {
        await add(product);
        added.push(product.name);
      }
      setStatus('Selección añadida al carrito.');
    } catch (error) {
      setStatus(`${added.length ? `Añadidos: ${added.join(', ')}. ` : ''}${error.message}`);
    } finally {
      setSelected((current) => current.filter((name) => !added.includes(name)));
      setBusy(false);
    }
  }

  return (
    <section className="products-section build-kit" aria-labelledby="build-kit-heading">
      <header className="build-kit-intro">
        <p className="editorial-kicker">Selección TechStore</p>
        <h1 id="build-kit-heading">Arma tu equipo</h1>
        <p>Combina productos del catálogo para tu PC, escritorio o cocina.</p>
      </header>
      <div className="build-kit-layout">
        <section className="build-kit-panel" aria-label="Opciones del equipo">
          <fieldset className="build-kit-types" disabled={busy}>
            <legend>Tipo de equipo</legend>
            <ul>
              {Object.entries(kits).map(([key, [label]]) => (
                <li key={key}>
                  <label>
                    <input
                      type="radio"
                      name="equipment-kit"
                      checked={kit === key}
                      onChange={() => {
                        setKit(key);
                        resetSelection();
                      }}
                    />
                    <span>{label}</span>
                  </label>
                </li>
              ))}
            </ul>
          </fieldset>
          {loadError && <p role="alert">{loadError}</p>}
          {!products && !loadError && <p role="status">Cargando productos…</p>}
          {products && (
            <>
              {kit === 'pc' ? (
                <>
                  <fieldset className="form-group">
                    <legend>Plataforma</legend>
                    <select
                      aria-label="Plataforma"
                      value={platform}
                      onChange={(event) => {
                        setPlatform(event.target.value);
                        resetSelection();
                      }}
                    >
                      <option value="AM4">AM4 con DDR4</option>
                      <option value="AM5">AM5 con DDR5</option>
                    </select>
                  </fieldset>
                  <p className="build-kit-guide">
                    Selección orientativa. La compatibilidad de cada placa y su BIOS está pendiente
                    de confirmar.
                  </p>
                  {platforms[platform].map((names, step) => (
                    <fieldset
                      className="form-group"
                      key={step}
                      disabled={step > 0 && !selected[step - 1]}
                    >
                      <legend>{['1. Procesador', '2. Placa madre', '3. Memoria RAM'][step]}</legend>
                      <select
                        aria-label={['Procesador', 'Placa madre', 'Memoria RAM'][step]}
                        value={selected[step] || ''}
                        onChange={(event) =>
                          setSelected([...selected.slice(0, step), event.target.value])
                        }
                      >
                        <option value="">Elige una opción</option>
                        {names
                          .filter((name) => products.has(name))
                          .map((name) => {
                            const product = products.get(name);
                            return (
                              <option key={name} value={name}>
                                {name} · {price(product.price)}
                                {stock(product) < 1 ? ' · Agotado' : ''}
                              </option>
                            );
                          })}
                      </select>
                    </fieldset>
                  ))}
                </>
              ) : (
                <fieldset className="form-group" disabled={busy}>
                  <legend>Productos del kit</legend>
                  <ul>
                    {kits[kit].slice(1).map((name) => {
                      const product = products.get(name);
                      return (
                        <li key={name}>
                          <label>
                            <input
                              type="checkbox"
                              checked={selected.includes(name)}
                              disabled={!product || stock(product) < 1}
                              onChange={(event) => {
                                setStatus('');
                                setSelected(
                                  event.target.checked
                                    ? [...selected, name]
                                    : selected.filter((item) => item !== name),
                                );
                              }}
                            />{' '}
                            {name}
                            {product ? ` · ${price(product.price)}` : ''}
                            {!product || stock(product) < 1 ? ' · No disponible' : ''}
                          </label>
                        </li>
                      );
                    })}
                  </ul>
                </fieldset>
              )}
            </>
          )}
        </section>
        <aside className="build-kit-panel build-kit-summary" aria-labelledby="build-kit-summary">
          <h2 id="build-kit-summary">Tu selección</h2>
          {chosen.length ? (
            <ul>
              {chosen.map((product) => (
                <li key={product._id}>
                  <img src={backendAssetUrl(product.image || placeholder)} alt="" loading="lazy" />
                  <span>
                    {product.name}
                    <small>{stock(product) < 1 ? 'Agotado' : 'Disponible'}</small>
                  </span>
                  <strong>{price(product.price)}</strong>
                </li>
              ))}
            </ul>
          ) : (
            <p>Aquí aparecerán los productos que elijas.</p>
          )}
          <p className="product-price" aria-live="polite">
            Subtotal {price(subtotal)}
          </p>
          <button
            type="button"
            className="btn btn-primary"
            disabled={Boolean(blockedReason) || busy}
            onClick={addKit}
          >
            {busy ? 'Añadiendo…' : 'Añadir selección al carrito'}
          </button>
          {blockedReason && <p className="build-kit-note">{blockedReason}</p>}
          <p role="status">{status}</p>
        </aside>
      </div>
    </section>
  );
}
