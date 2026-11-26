import { useEffect, useState } from 'react';
import { backendAssetUrl, requestJson } from '../services/api.js';
import { placeholder } from '../config/storeCatalog.js';
import { useCartActions } from '../components/cart/CartContext.js';
import { money as price } from '../utils/formatters.js';
import BuildKitProgress from '../components/catalog/BuildKitProgress.jsx';
import BuildKitPreview from '../components/catalog/BuildKitPreview.jsx';
import { extraPcSteps, pcCompatibility } from '../features/catalog/pcParts.js';

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
  study: [
    'Estudio',
    "Monitor LG UltraGear 27'' 144Hz",
    'Teclado Mecánico Keychron K2',
    'Cámara Web Logitech Brio 4K',
  ],
  gaming: [
    'Gaming',
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
const pcLabels = ['Procesador', 'Placa madre', 'Memoria RAM'];

function readSharedSelection() {
  const params = new URLSearchParams(window.location.search);
  const requestedKit = params.get('kit');
  const kit = Object.hasOwn(kits, requestedKit) ? requestedKit : 'pc';
  const requestedPlatform = params.get('platform');
  const platform = Object.hasOwn(platforms, requestedPlatform) ? requestedPlatform : 'AM4';
  const names = params.getAll('part').slice(0, 8);
  const listedPrices = params.getAll('partPrice').slice(0, 8);
  const listedSlots = params.getAll('partSlot').slice(0, 8);
  const prices = new Map(names.flatMap((name, index) =>
    /^\d{1,8}(?:\.\d{1,2})?$/.test(listedPrices[index] ?? '')
      ? [[name, Number(listedPrices[index])]]
      : [],
  ));
  const selected = [];
  if (kit === 'pc') {
    for (const options of platforms[platform]) {
      const part = names[selected.length];
      if (!options.includes(part)) break;
      selected.push(part);
    }
  } else {
    selected.push(...kits[kit].slice(1).filter((name) => names.includes(name)));
  }
  return {
    kit, platform, selected, prices,
    extra: kit === 'pc' && selected.length === pcLabels.length
      ? [...new Set(names.slice(3).filter((name) => name && name.length <= 100 && !selected.includes(name)))]
      : [],
    extraLabels: new Map(names.slice(3).map((name, index) => [name, listedSlots[index + 3]])),
  };
}

export default function BuildKitPage({ user }) {
  const { add } = useCartActions();
  const [sharedSelection] = useState(readSharedSelection);
  const [products, setProducts] = useState(null);
  const [kit, setKit] = useState(sharedSelection.kit);
  const [platform, setPlatform] = useState(sharedSelection.platform);
  const [selected, setSelected] = useState(sharedSelection.selected);
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [onlyAvailable, setOnlyAvailable] = useState(true);
  const [extras, setExtras] = useState(sharedSelection.extra);

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
    setExtras([]);
    setStatus('');
  }

  const extraSteps = kit === 'pc' ? extraPcSteps(products) : [];
  const currentExtra = ({ label, names }) =>
    extras.find((name) => names.includes(name) ||
      (!products?.has(name) && sharedSelection.extraLabels.get(name) === label));
  const extraSlots = extraSteps.map(({ label, names }) => ({
    label,
    product: products?.get(currentExtra({ label, names })),
  }));
  const chosen = [
    ...selected.map((name) => products?.get(name)).filter(Boolean),
    ...(selected.length === pcLabels.length
      ? extraSlots.map(({ product }) => product).filter(Boolean)
      : []),
  ];
  const missing = products ? [...selected, ...extras].filter((name) => !products.has(name)) : [];
  const subtotal = chosen.reduce((total, item) => total + Number(item.price), 0);
  const hasSoldOut = chosen.some((product) => stock(product) < 1);
  const hasReplacement = (names, current) =>
    names.some((name) => name !== current && products?.has(name) && stock(products.get(name)) > 0);
  const replacementTargets = new Map(kit === 'pc' ? [
    ...selected.flatMap((name, index) => hasReplacement(platforms[platform][index], name)
      ? [[name, `build-pc-${index}`]]
      : []),
    ...extraSteps.flatMap((step, index) => {
      const name = currentExtra(step);
      return name && hasReplacement(step.names, name) ? [[name, `build-extra-${index}`]] : [];
    }),
  ] : []);
  const steps =
    kit === 'pc'
      ? [
          ...pcLabels.map((label, index) => ({
            label,
            target: `build-pc-${index}`,
            state: selected[index] ? 'selected' : selected.length === index ? 'current' : 'pending',
            disabled: !products || (index > 0 && !selected[index - 1]),
          })),
          {
            label: 'Resumen',
            target: 'build-kit-summary',
            state: selected.length === 3 ? 'current' : 'pending',
            disabled: !chosen.length,
          },
        ]
      : [
          { label: 'Tipo de equipo', target: 'build-kit-type', state: 'selected' },
          {
            label: 'Productos',
            target: 'build-kit-products',
            state: chosen.length ? 'selected' : 'current',
            disabled: !products,
          },
          {
            label: 'Resumen',
            target: 'build-kit-summary',
            state: chosen.length ? 'current' : 'pending',
            disabled: !chosen.length,
          },
        ];
  const previewSlots =
    kit === 'pc'
      ? [
          ...pcLabels.map((label, index) => ({ label, product: products?.get(selected[index]) })),
          ...extraSlots,
        ]
      : kits[kit].slice(1).map((label) => ({
          label,
          product: selected.includes(label) ? products?.get(label) : null,
        }));
  const blockedReason = missing.length
    ? 'Hay productos de la selección que ya no están en el catálogo. Actualiza tu selección.'
    : hasSoldOut
      ? 'Tu selección incluye productos agotados.'
      : !chosen.length
        ? 'Selecciona al menos un producto disponible.'
        : '';

  function selectionParams() {
    const params = new URLSearchParams({ kit });
    if (kit === 'pc') params.set('platform', platform);
    for (const name of selected) params.append('part', name);
    if (kit === 'pc' && selected.length === pcLabels.length)
      for (const name of extras) params.append('part', name);
    return params.toString();
  }

  async function copySelection() {
    const url = new URL(window.location.pathname, window.location.origin);
    url.search = selectionParams();
    for (const name of url.searchParams.getAll('part')) {
      const part = products?.get(name);
      url.searchParams.append('partPrice', part ? Number(part.price).toFixed(2) : '');
      const slot = extraSteps.find((step) => currentExtra(step) === name)?.label;
      url.searchParams.append('partSlot', slot ?? sharedSelection.extraLabels.get(name) ?? '');
    }
    try {
      await navigator.clipboard.writeText(url.href);
      setStatus('Enlace de la selección copiado.');
    } catch {
      setStatus('No se pudo copiar el enlace de la selección.');
    }
  }

  async function saveSelection() {
    setSaving(true);
    try {
      const { alreadySaved } = await requestJson('/api/saved-build', {
        method: 'PUT',
        body: JSON.stringify({ selection: selectionParams() }),
      });
      setStatus(
        alreadySaved ? 'Esta selección ya está en Mis armados.' : 'Selección guardada en Mi cuenta.',
      );
    } catch (error) {
      setStatus(error.message);
    } finally {
      setSaving(false);
    }
  }

  async function addKit() {
    if (kit === 'pc' || blockedReason) return;
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
        <h1 id="build-kit-heading">Crea tu selección</h1>
        <p>Combina productos del catálogo para tu PC, escritorio o cocina.</p>
      </header>
      <BuildKitProgress steps={steps} busy={busy} />
      <div className="build-kit-layout">
        <section className="build-kit-panel" aria-label="Opciones del equipo">
          <fieldset className="build-kit-types" disabled={busy}>
            <legend>Tipo de equipo</legend>
            <ul>
              {Object.entries(kits).map(([key, [label]]) => (
                <li key={key}>
                  <label>
                    <input
                      id={key === 'pc' ? 'build-kit-type' : undefined}
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
                    Simula un armado para comparar piezas y estimar su costo. Puedes guardarlo o
                    compartirlo.
                  </p>
                  <label>
                    <input
                      type="checkbox"
                      checked={onlyAvailable}
                      onChange={(event) => setOnlyAvailable(event.target.checked)}
                    />{' '}
                    Mostrar solo piezas disponibles
                  </label>
                  {platforms[platform].map((names, step) => (
                    <fieldset
                      className="form-group"
                      key={step}
                      disabled={step > 0 && !selected[step - 1]}
                    >
                      <legend>{['1. Procesador', '2. Placa madre', '3. Memoria RAM'][step]}</legend>
                      <select
                        id={`build-pc-${step}`}
                        aria-label={['Procesador', 'Placa madre', 'Memoria RAM'][step]}
                        value={selected[step] || ''}
                        onChange={(event) => {
                          const name = event.target.value;
                          if (!name) setExtras([]);
                          setSelected(name
                            ? [...selected.slice(0, step), name, ...selected.slice(step + 1)]
                            : selected.slice(0, step));
                        }}
                      >
                        <option value="">Elige una opción</option>
                        {selected[step] && !products.has(selected[step]) && (
                          <option value={selected[step]}>{selected[step]} (fuera del catálogo)</option>
                        )}
                        {names
                          .filter((name) => {
                            const product = products.get(name);
                            return (
                              product &&
                              (!onlyAvailable || stock(product) > 0 || name === selected[step])
                            );
                          })
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
                  {extraSteps.length > 0 && (
                    <fieldset
                      className="form-group"
                      disabled={busy || selected.length < pcLabels.length}
                    >
                      <legend>Piezas adicionales</legend>
                      {extraSteps.map(({ label, names }, index) => {
                        const current = currentExtra({ label, names }) ?? '';
                        return (
                          <label key={label}>
                            {label}
                            <select
                              id={`build-extra-${index}`}
                              aria-label={label}
                              value={current}
                              onChange={(event) => {
                                const next = event.target.value;
                                setExtras((previous) =>
                                  previous
                                    .filter((name) => name !== current && !names.includes(name))
                                    .concat(next ? [next] : []),
                                );
                              }}
                            >
                              <option value="">Sin seleccionar</option>
                              {current && !products.has(current) && (
                                <option value={current}>{current} (fuera del catálogo)</option>
                              )}
                              {names
                                .filter(
                                  (name) =>
                                    name === current ||
                                    !onlyAvailable ||
                                    stock(products.get(name)) > 0,
                                )
                                .map((name) => (
                                  <option key={name} value={name}>
                                    {name} · {price(products.get(name).price)}
                                    {stock(products.get(name)) < 1 ? ' · Agotado' : ''}
                                  </option>
                                ))}
                            </select>
                          </label>
                        );
                      })}
                    </fieldset>
                  )}
                </>
              ) : (
                <fieldset
                  id="build-kit-products"
                  tabIndex={-1}
                  className="form-group"
                  disabled={busy}
                >
                  <legend>Productos del kit</legend>
                  {!kits[kit]
                    .slice(1)
                    .some((name) => products.has(name) && stock(products.get(name)) > 0) && (
                    <p>No hay productos disponibles para este kit.</p>
                  )}
                  <ul>
                    {kits[kit]
                      .slice(1)
                      .filter(
                        (name) =>
                          selected.includes(name) ||
                          (products.has(name) && stock(products.get(name)) > 0),
                      )
                      .map((name) => {
                        const product = products.get(name);
                        return (
                          <li key={name}>
                            <label>
                              <input
                                type="checkbox"
                                checked={selected.includes(name)}
                                disabled={
                                  !selected.includes(name) && (!product || stock(product) < 1)
                                }
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
          <h2 id="build-kit-summary" tabIndex={-1}>
            Tu selección
          </h2>
          <BuildKitPreview slots={previewSlots} />
          {kit === 'pc' &&
            pcCompatibility(
              Object.fromEntries(previewSlots.map(({ label, product }) => [label, product])),
            ).map((message) => (
              <p key={message} className="build-kit-note">
                {message}
              </p>
            ))}
          {chosen.length || missing.length ? (
            <ul className="build-kit-parts">
              {chosen.map((product) => (
                <li key={product._id}>
                  <img src={backendAssetUrl(product.image || placeholder)} alt="" loading="lazy" />
                  <span>
                    {product.name}
                    <small>{stock(product) < 1 ? 'Agotado' : 'Disponible'}</small>
                    {sharedSelection.prices.has(product.name) &&
                      sharedSelection.prices.get(product.name) !== Number(product.price) && (
                        <small>Precio indicado en el enlace {price(sharedSelection.prices.get(product.name))}</small>
                      )}
                  </span>
                  <strong>{price(product.price)}</strong>
                  {stock(product) < 1 && replacementTargets.has(product.name) && (
                    <button type="button" className="btn btn-secondary" onClick={() =>
                      document.getElementById(replacementTargets.get(product.name))?.focus()}>
                      Elegir reemplazo para {product.name}
                    </button>
                  )}
                </li>
              ))}
              {missing.map((name) => (
                <li key={name}>
                  <span>{name} · Fuera del catálogo</span>
                  {replacementTargets.has(name) ? (
                    <button type="button" className="btn btn-secondary" onClick={() =>
                      document.getElementById(replacementTargets.get(name))?.focus()}>
                      Elegir reemplazo para {name}
                    </button>
                  ) : extras.includes(name) && (
                    <button type="button" className="btn btn-secondary" onClick={() =>
                      setExtras((current) => current.filter((part) => part !== name))}>
                      Quitar {name}
                    </button>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p>Aquí aparecerán los productos que elijas.</p>
          )}
          <p className="product-price" aria-live="polite">
            {kit === 'pc' ? 'Subtotal estimado' : 'Subtotal'} {price(subtotal)}
          </p>
          {kit !== 'pc' && (
            <button
              type="button"
              className="btn btn-primary"
              disabled={Boolean(blockedReason) || busy}
              onClick={addKit}
            >
              {busy ? 'Añadiendo…' : 'Añadir selección al carrito'}
            </button>
          )}
          {blockedReason && (kit !== 'pc' || missing.length > 0 || hasSoldOut) && (
            <p className="build-kit-note">{blockedReason}</p>
          )}
          {user && chosen.length > 0 && (
            <button
              type="button"
              className={kit === 'pc' ? 'btn btn-primary' : 'btn btn-secondary'}
              disabled={busy || saving || missing.length > 0}
              onClick={saveSelection}
            >
              {saving ? 'Guardando…' : kit === 'pc' ? 'Guardar armado' : 'Guardar selección'}
            </button>
          )}
          {chosen.length > 0 && (
            <button
              type="button"
              className={kit === 'pc' && !user ? 'btn btn-primary' : 'btn btn-secondary'}
              disabled={busy}
              onClick={copySelection}
            >
              {kit === 'pc' ? 'Compartir armado' : 'Copiar enlace de la selección'}
            </button>
          )}
          <p role="status">{status}</p>
        </aside>
      </div>
    </section>
  );
}
