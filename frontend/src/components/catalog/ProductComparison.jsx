const normalize = (name) => name.trim().normalize('NFKC').toLocaleLowerCase('es');
const currency = new Intl.NumberFormat('es-EC', { style: 'currency', currency: 'USD' });

export default function ProductComparison({ products, clear }) {
  const specs = products.map(
    (product) =>
      new Map(
        (product.specifications || []).map(({ name, value }) => [normalize(name), { name, value }]),
      ),
  );
  const rows = new Map(
    specs.flatMap((entries) => [...entries].map(([key, item]) => [key, item.name])),
  );
  return (
    <section className="product-comparison" aria-labelledby="comparison-title">
      <h2 id="comparison-title">Comparar productos</h2>
      <p role="status">
        {products.length} de 3 seleccionados. Elige productos de la misma categoría.
      </p>
      <button type="button" className="btn btn-secondary" onClick={clear}>
        Limpiar selección
      </button>
      {products.length > 1 && (
        <div
          className="comparison-scroll"
          tabIndex={0}
          role="region"
          aria-label="Tabla de comparación"
        >
          <table>
            <thead>
              <tr>
                <th scope="col">Característica</th>
                {products.map((product) => (
                  <th scope="col" key={product._id}>
                    <a href={`/producto/${product._id}`}>{product.name}</a>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                <th scope="row">Precio</th>
                {products.map((product) => (
                  <td key={product._id}>{currency.format(product.price)}</td>
                ))}
              </tr>
              <tr>
                <th scope="row">Disponibilidad</th>
                {products.map((product) => (
                  <td key={product._id}>
                    {(product.availableStock ?? product.stock) > 0 ? 'Disponible' : 'Agotado'}
                  </td>
                ))}
              </tr>
              {[...rows].map(([key, name]) => (
                <tr key={key}>
                  <th scope="row">{name}</th>
                  {products.map((product, index) => (
                    <td key={product._id}>{specs[index].get(key)?.value ?? 'Sin especificar'}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
