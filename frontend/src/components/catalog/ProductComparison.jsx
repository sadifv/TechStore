import { backendAssetUrl } from '../../services/api.js';
import { placeholder } from '../../config/storeCatalog.js';
import { money } from '../../utils/formatters.js';
import { useId, useState } from 'react';

const normalize = (name) => name.trim().normalize('NFKC').toLocaleLowerCase('es');
const differs = (values) => new Set(values).size > 1;

export default function ProductComparison({ products, clear }) {
  const headingId = useId();
  const [differencesOnly, setDifferencesOnly] = useState(false);
  const [highlighted, setHighlighted] = useState(null);
  const activeId = products.some((product) => product._id === highlighted) ? highlighted : null;
  const specs = products.map(
    (product) =>
      new Map(
        (product.specifications || []).map(({ name, value }) => [normalize(name), { name, value }]),
      ),
  );
  const rows = new Map(
    specs.flatMap((entries) => [...entries].map(([key, item]) => [key, item.name])),
  );
  const visibleRows = [...rows].filter(
    ([key]) => !differencesOnly || differs(specs.map((entries) => entries.get(key)?.value ?? null)),
  );
  const showPrice = !differencesOnly || differs(products.map((product) => Number(product.price)));
  const showStock =
    !differencesOnly ||
    differs(products.map((product) => (product.availableStock ?? product.stock) > 0));
  return (
    <section className="product-comparison" aria-labelledby={headingId}>
      <header className="comparison-heading">
        <h2 id={headingId}>Comparar productos</h2>
        <button type="button" className="btn btn-secondary" onClick={clear}>
          Limpiar selección
        </button>
      </header>
      <p role="status">
        {products.length} de 3 seleccionados. Elige productos de la misma categoría.
      </p>
      {products.length > 1 && (
        <label className="comparison-differences">
          <input
            type="checkbox"
            checked={differencesOnly}
            onChange={(event) => setDifferencesOnly(event.target.checked)}
          />
          Mostrar solo diferencias
        </label>
      )}
      {products.length > 1 && (
        <div
          className="comparison-scroll"
          tabIndex={0}
          role="region"
          aria-label="Tabla de comparación"
        >
          <table>
            <caption className="sr-only">
              Precios, disponibilidad y especificaciones del catálogo. Destacar una columna no es
              una recomendación.
            </caption>
            <thead>
              <tr>
                <th scope="col">Característica</th>
                {products.map((product) => (
                  <th scope="col" key={product._id} data-highlighted={product._id === activeId}>
                    <a className="comparison-product" href={`/producto/${product._id}`}>
                      <img
                        src={backendAssetUrl(product.image || placeholder)}
                        alt=""
                        loading="lazy"
                        width={160}
                        height={80}
                      />
                      <span>{product.name}</span>
                    </a>
                    <button
                      className="comparison-highlight"
                      type="button"
                      aria-pressed={product._id === activeId}
                      onClick={() => setHighlighted(product._id === activeId ? null : product._id)}
                    >
                      {product._id === activeId ? 'Columna destacada' : 'Destacar columna'}
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {showPrice && (
                <tr>
                  <th scope="row">Precio</th>
                  {products.map((product) => (
                    <td
                      className="comparison-price"
                      key={product._id}
                      data-highlighted={product._id === activeId}
                    >
                      {money(product.price)}
                    </td>
                  ))}
                </tr>
              )}
              {showStock && (
                <tr>
                  <th scope="row">Disponibilidad</th>
                  {products.map((product) => (
                    <td key={product._id} data-highlighted={product._id === activeId}>
                      <span
                        className="comparison-stock"
                        data-available={(product.availableStock ?? product.stock) > 0}
                      >
                        {(product.availableStock ?? product.stock) > 0 ? 'Disponible' : 'Agotado'}
                      </span>
                    </td>
                  ))}
                </tr>
              )}
              {visibleRows.length > 0 && (
                <tr className="comparison-group">
                  <th colSpan={products.length + 1}>Especificaciones del catálogo</th>
                </tr>
              )}
              {visibleRows.map(([key, name]) => (
                <tr key={key}>
                  <th scope="row">{name}</th>
                  {products.map((product, index) => (
                    <td key={product._id} data-highlighted={product._id === activeId}>
                      {specs[index].get(key)?.value ?? 'Sin especificar'}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {products.length > 1 &&
        differencesOnly &&
        !showPrice &&
        !showStock &&
        !visibleRows.length && (
          <p role="status">
            No hay diferencias en los datos publicados. Los campos faltantes no permiten confirmar
            que los productos sean equivalentes.
          </p>
        )}
      {products.length > 1 && (
        <p className="comparison-note">
          Precio y disponibilidad al consultar. «Sin especificar» significa que falta el dato;
          comparar no reserva stock.
        </p>
      )}
    </section>
  );
}
