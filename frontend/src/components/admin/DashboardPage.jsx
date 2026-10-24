import { useEffect, useRef, useState } from 'react';
import { backendAssetUrl } from '../../api.js';
import {
  AdminNotice,
  AdminPagination,
  adminMutation,
  categories,
  date,
  money,
  placeholder,
  statuses,
  useAdminData,
} from './shared.jsx';

export function AdminDashboardPage() {
  const [subscriberPage, setSubscriberPage] = useState(1);
  const { data, error, refresh } = useAdminData(
    `/api/admin/dashboard?subscribersPage=${subscriberPage}`,
  );
  const [product, setProduct] = useState(null);
  const [flashProduct, setFlashProduct] = useState(null);
  const productDialog = useRef(null);
  const flashDialog = useRef(null);
  const imageFile = useRef(null);
  const [imagePreview, setImagePreview] = useState(placeholder);
  const [formError, setFormError] = useState('');
  const [busy, setBusy] = useState(false);
  const [flashDiscount, setFlashDiscount] = useState(20);
  const [flashDuration, setFlashDuration] = useState(24);

  useEffect(() => {
    if (productDialog.current)
      product ? productDialog.current.showModal() : productDialog.current.close();
  }, [product]);
  useEffect(() => {
    if (flashDialog.current)
      flashProduct ? flashDialog.current.showModal() : flashDialog.current.close();
  }, [flashProduct]);
  useEffect(() => {
    const file = imageFile.current?.files?.[0];
    if (!file) {
      setImagePreview(backendAssetUrl(product?.image || placeholder));
      return undefined;
    }
    const url = URL.createObjectURL(file);
    setImagePreview(url);
    return () => URL.revokeObjectURL(url);
  }, [product]);

  async function submitProduct(event) {
    event.preventDefault();
    setBusy(true);
    setFormError('');
    const form = new FormData(event.currentTarget);
    const id = form.get('id');
    try {
      await adminMutation(id ? `/api/admin/products/${id}` : '/api/admin/products', {
        method: id ? 'PUT' : 'POST',
        body: form,
      });
      productDialog.current?.close();
      setProduct(null);
      refresh();
    } catch (cause) {
      setFormError(cause.message);
    } finally {
      setBusy(false);
    }
  }
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
  async function submitFlash(event) {
    event.preventDefault();
    setBusy(true);
    try {
      await adminMutation(`/api/admin/products/${flashProduct._id}/flash-sale`, {
        method: 'POST',
        body: JSON.stringify({
          discount: Number(flashDiscount),
          durationHours: Number(flashDuration),
        }),
      });
      flashDialog.current?.close();
      setFlashProduct(null);
      refresh();
    } catch (cause) {
      window.alert(cause.message);
    } finally {
      setBusy(false);
    }
  }
  async function removeResource(kind, id) {
    if (
      !window.confirm(
        kind === 'messages'
          ? 'Este mensaje se eliminará permanentemente.'
          : 'Se eliminará este suscriptor.',
      )
    )
      return;
    try {
      await adminMutation(`/api/admin/${kind}/${id}`, { method: 'DELETE' });
      refresh();
    } catch (cause) {
      window.alert(cause.message);
    }
  }

  if (error) return <AdminNotice error={error} />;
  if (!data)
    return (
      <section className="admin-container container">
        <p role="status">Cargando panel…</p>
      </section>
    );
  const {
    orders = [],
    products = [],
    topProducts = [],
    messages = [],
    subscribers = [],
    subscriberPagination,
  } = data;
  return (
    <section className="admin-container container" aria-labelledby="admin-dashboard-heading">
      <header className="admin-header">
        <h1 id="admin-dashboard-heading">
          <i className="ri-dashboard-line" /> Panel de Administración
        </h1>
        <nav className="admin-header-actions" aria-label="Gestión de administración">
          <a href="/admin/users" className="btn btn-outline">
            Usuarios
          </a>
          <a href="/admin/marketing" className="btn btn-primary">
            Marketing y cupones
          </a>
        </nav>
      </header>
      <section className="dashboard-stats" aria-label="Resumen de ventas">
        {[
          ['Órdenes Totales', data.totalOrders],
          ['Ingresos Pagados', money(data.totalRevenue)],
          ['Productos Vendidos', data.totalProductsSold],
          ['Carritos Activos', data.activeCartCount],
        ].map(([label, value]) => (
          <article className="stat-card" key={label}>
            <h3>{label}</h3>
            <p className="stat-number">{value ?? 0}</p>
          </article>
        ))}
      </section>
      <section className="dashboard-orders">
        <div className="section-heading">
          <h2 className="section-title">Órdenes recientes</h2>
          <a href="/admin/orders" className="btn btn-sm btn-outline">
            Ver todas
          </a>
        </div>
        <div className="admin-table-wrapper">
          <table className="admin-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Cliente</th>
                <th>Total</th>
                <th>Estado</th>
                <th>Fecha</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order, index) => (
                <tr key={order._id}>
                  <td>{index + 1}</td>
                  <td>
                    {order.user?.name || order.guestInfo?.name || 'Invitado'}
                    <small>{order.user?.email || order.guestInfo?.email}</small>
                  </td>
                  <td>{money(order.totalAmount)}</td>
                  <td>
                    <span className={`status-${order.status}`}>
                      {statuses[order.status] || order.status}
                    </span>
                  </td>
                  <td>{date(order.createdAt)}</td>
                  <td>
                    <a href={`/admin/orders/${order._id}`} className="btn btn-sm btn-primary">
                      Ver
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
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
      <section className="dashboard-messages">
        <h2 className="section-title">Mensajes de contacto</h2>
        <div className="admin-table-wrapper">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Correo</th>
                <th>Mensaje</th>
                <th>Fecha</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {messages.map((message) => (
                <tr key={message._id}>
                  <td>{message.name}</td>
                  <td>
                    <a href={`mailto:${message.email}`}>{message.email}</a>
                  </td>
                  <td className="admin-message-content">{message.message}</td>
                  <td>{date(message.createdAt)}</td>
                  <td>
                    <button
                      className="btn btn-sm btn-delete"
                      type="button"
                      onClick={() => removeResource('messages', message._id)}
                    >
                      Eliminar
                    </button>
                  </td>
                </tr>
              ))}
              {!messages.length && (
                <tr>
                  <td colSpan="5">No hay mensajes.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
      <section className="dashboard-newsletter">
        <h2 className="section-title">Suscriptores al boletín</h2>
        <p className="text-muted">
          {subscriberPagination.totalSubscribers} suscriptores registrados; se muestran hasta 20 por
          página.
        </p>
        <div className="admin-table-wrapper">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Correo</th>
                <th>Fecha</th>
                <th>Marketing</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {subscribers.map((subscriber) => (
                <tr key={subscriber._id}>
                  <td>
                    <a href={`mailto:${subscriber.email}`}>{subscriber.email}</a>
                  </td>
                  <td>{date(subscriber.createdAt)}</td>
                  <td>{subscriber.isSubscribed === false ? 'Dio de baja' : 'Activo'}</td>
                  <td>
                    <button
                      className="btn btn-sm btn-delete"
                      type="button"
                      onClick={() => removeResource('subscribers', subscriber._id)}
                    >
                      Eliminar
                    </button>
                  </td>
                </tr>
              ))}
              {!subscribers.length && (
                <tr>
                  <td colSpan="4">No hay suscriptores.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <AdminPagination pagination={subscriberPagination} onPage={setSubscriberPage} />
      </section>
      <section className="dashboard-products">
        <h2 className="section-title">Productos más vendidos</h2>
        <div className="products-grid">
          {topProducts.map((item) => (
            <article className="product-card" key={item._id}>
              <a href={`/producto/${item._id}`}>
                <img src={backendAssetUrl(item.image || placeholder)} alt={item.name} />
                <h4>{item.name}</h4>
              </a>
              <p className="product-price">{money(item.price)}</p>
              <small>{item.unitsSold} vendidos</small>
            </article>
          ))}
          {!topProducts.length && <p className="empty-msg">Todavía no hay productos vendidos.</p>}
        </div>
      </section>
      <dialog ref={productDialog} className="modal-dialog" onClose={() => setProduct(null)}>
        <article className="modal-card">
          <header className="modal-header">
            <h2>{product?._id ? 'Editar producto' : 'Agregar producto'}</h2>
            <button
              type="button"
              className="btn-close"
              aria-label="Cerrar"
              onClick={() => productDialog.current?.close()}
            >
              ×
            </button>
          </header>
          <form
            key={product?._id || 'new-product'}
            onSubmit={submitProduct}
            encType="multipart/form-data"
          >
            <input type="hidden" name="id" value={product?._id || ''} />
            <p className="form-field">
              <label htmlFor="prod-name">Nombre del producto</label>
              <input
                id="prod-name"
                name="name"
                defaultValue={product?.name || ''}
                required
                minLength="2"
                maxLength="100"
              />
            </p>
            <p className="form-field">
              <label htmlFor="prod-description">Descripción</label>
              <textarea
                id="prod-description"
                name="description"
                defaultValue={product?.description || ''}
                rows="3"
                required
              />
            </p>
            <fieldset className="form-group-inline">
              <p className="form-field">
                <label htmlFor="prod-price">Precio ($)</label>
                <input
                  id="prod-price"
                  name="price"
                  type="number"
                  step="0.01"
                  min="0.01"
                  defaultValue={product?.price || ''}
                  required
                />
              </p>
              <p className="form-field">
                <label htmlFor="prod-stock">Stock</label>
                <input
                  id="prod-stock"
                  name="stock"
                  type="number"
                  min="0"
                  defaultValue={product?.stock ?? ''}
                  required
                />
              </p>
            </fieldset>
            <p className="form-field">
              <label htmlFor="prod-category">Categoría</label>
              <select
                id="prod-category"
                name="category"
                defaultValue={product?.category || ''}
                required
              >
                <option value="">Selecciona una categoría</option>
                {categories.map((category) => (
                  <option key={category}>{category}</option>
                ))}
              </select>
            </p>
            <p className="form-field">
              <label htmlFor="prod-image-file">Imagen del producto (opcional)</label>
              <input
                ref={imageFile}
                id="prod-image-file"
                name="imageFile"
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) setImagePreview(URL.createObjectURL(file));
                }}
              />
            </p>
            <p className="form-field">
              <label htmlFor="prod-image">URL de imagen (si no subes un archivo)</label>
              <input
                id="prod-image"
                name="image"
                type="url"
                defaultValue={product?.image || ''}
                placeholder="https://..."
                onChange={(event) => {
                  if (!imageFile.current?.files?.length && event.target.value)
                    setImagePreview(event.target.value);
                }}
              />
            </p>
            <figure className="form-field image-preview-container">
              <figcaption>Vista previa</figcaption>
              <img src={imagePreview} alt="Vista previa del producto" />
            </figure>
            {formError && (
              <output className="form-status error" role="alert">
                {formError}
              </output>
            )}
            <footer className="modal-actions">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => productDialog.current?.close()}
              >
                Cancelar
              </button>
              <button type="submit" className="btn btn-primary" disabled={busy}>
                {busy ? 'Guardando…' : 'Guardar producto'}
              </button>
            </footer>
          </form>
        </article>
      </dialog>
      <dialog ref={flashDialog} className="modal-dialog" onClose={() => setFlashProduct(null)}>
        <article className="modal-card">
          <header className="modal-header">
            <h2>Configurar oferta relámpago</h2>
            <button
              type="button"
              className="btn-close"
              aria-label="Cerrar"
              onClick={() => flashDialog.current?.close()}
            >
              ×
            </button>
          </header>
          <form onSubmit={submitFlash}>
            <p className="form-field">
              <span>Producto</span>
              <output>{flashProduct?.name}</output>
            </p>
            <p className="form-field">
              <span>Precio actual</span>
              <output>{money(flashProduct?.price)}</output>
            </p>
            <fieldset className="form-group-inline">
              <p className="form-field">
                <label htmlFor="flash-discount">Descuento (%)</label>
                <input
                  id="flash-discount"
                  type="number"
                  min="1"
                  max="90"
                  value={flashDiscount}
                  onChange={(event) => setFlashDiscount(Number(event.target.value))}
                />
              </p>
              <p className="form-field">
                <label htmlFor="flash-duration">Duración (horas)</label>
                <input
                  id="flash-duration"
                  type="number"
                  min="1"
                  max="168"
                  value={flashDuration}
                  onChange={(event) => setFlashDuration(Number(event.target.value))}
                />
              </p>
            </fieldset>
            <p>
              Precio final: {money(Number(flashProduct?.price || 0) * (1 - flashDiscount / 100))}
            </p>
            <footer className="modal-actions">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => flashDialog.current?.close()}
              >
                Cancelar
              </button>
              <button className="btn btn-primary" disabled={busy}>
                Activar oferta
              </button>
            </footer>
          </form>
        </article>
      </dialog>
    </section>
  );
}
