export default function ProductSpecifications({ specifications }) {
  if (!Array.isArray(specifications) || !specifications.length) return null;
  return (
    <section className="product-specifications" aria-labelledby="product-specifications-heading">
      <h2 id="product-specifications-heading">Especificaciones técnicas</h2>
      <dl>
        {specifications.map(({ name, value }) => (
          <div key={name}>
            <dt>{name}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
