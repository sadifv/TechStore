import { useState } from 'react';
import { backendAssetUrl } from '../../services/api.js';
import { adminMutation } from '../../services/adminMutation.js';
import { money } from '../../utils/formatters.js';
import { placeholder } from '../../config/storeCatalog.js';
import ProductEditorDialog from './ProductEditorDialog.jsx';
import FlashSaleDialog from './FlashSaleDialog.jsx';

export default function DashboardCatalog({ products, refresh }) {
  const [product, setProduct] = useState(null);
  const [flashProduct, setFlashProduct] = useState(null);
  const [busy, setBusy] = useState(false);
  const [flashDiscount, setFlashDiscount] = useState(20);
  const [flashDuration, setFlashDuration] = useState(24);
  async function deleteProduct(item) {
    if (!window.confirm(`¿Archivar el producto “${item.name}”?`)) return;
    try {
      await adminMutation(`/api/admin/products/${item._id}`, { method: 'DELETE' });
      refresh();
    } catch (cause) {
      window.alert(cause.message);
    }
  }
  async function toggleFlash(item) {
    if (item.flashSale) {
      if (!window.confirm('Se detendrá la oferta y el precio volverá a su valor original.')) return;
      try {
        await adminMutation(`/api/admin/products/${item._id}/flash-sale`, { method: 'DELETE' });
        refresh();
      } catch (cause) {
        window.alert(cause.message);
      }
    } else {
      setFlashDiscount(20);
      setFlashDuration(24);
      setFlashProduct(item);
    }
  }
  return (
    <>
      <section className="dashboard-products">
        <header className="section-heading">
          <h2 className="section-title">Gestión del catálogo</h2>
          <button type="button" className="btn btn-primary" onClick={() => setProduct({})}>
            Nuevo producto
          </button>
        </header>
        <div className="admin-table-wrapper">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Imagen</th>
                <th>Producto</th>
                <th>Categoría</th>
                <th>Precio</th>
                <th>Stock</th>
                <th>Oferta</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {products.map((item) => (
                <tr key={item._id}>
                  <td>
                    <img
                      className="admin-product-thumbnail"
                      src={backendAssetUrl(item.image || placeholder)}
                      alt={item.name}
                    />
                  </td>
                  <td>{item.name}</td>
                  <td>{item.category}</td>
                  <td>{money(item.price)}</td>
                  <td>{item.stock}</td>
                  <td>{item.flashSale ? `${item.flashSaleDiscount}%` : '—'}</td>
                  <td>
                    <button
                      className="btn btn-sm btn-outline"
                      type="button"
                      onClick={() => setProduct(item)}
                    >
                      Editar
                    </button>{' '}
                    <button
                      className="btn btn-sm btn-outline"
                      type="button"
                      onClick={() => toggleFlash(item)}
                    >
                      {item.flashSale ? 'Detener oferta' : 'Oferta'}
                    </button>{' '}
                    <button
                      className="btn btn-sm btn-delete"
                      type="button"
                      onClick={() => deleteProduct(item)}
                    >
                      Eliminar
                    </button>
                  </td>
                </tr>
              ))}
              {!products.length && (
                <tr>
                  <td colSpan="7">No hay productos registrados.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
      <ProductEditorDialog
        product={product}
        setProduct={setProduct}
        refresh={refresh}
        busy={busy}
        setBusy={setBusy}
      />
      <FlashSaleDialog
        flashProduct={flashProduct}
        setFlashProduct={setFlashProduct}
        flashDiscount={flashDiscount}
        setFlashDiscount={setFlashDiscount}
        flashDuration={flashDuration}
        setFlashDuration={setFlashDuration}
        busy={busy}
        setBusy={setBusy}
        refresh={refresh}
      />
    </>
  );
}
