import { useState } from 'react';
import { useAdminData } from '../../hooks/useAdminData.js';
import { AdminPagination } from './AdminPagination.jsx';

const actionLabels = {
  'product.created': 'Producto creado',
  'product.updated': 'Producto actualizado',
  'product.archived': 'Producto archivado',
  'product.flash_sale_activated': 'Oferta activada',
  'product.flash_sale_deactivated': 'Oferta detenida',
  'order.payment_confirmed': 'Pago confirmado',
  'order.status_updated': 'Envío actualizado',
  'order.contact_confirmed': 'Contacto confirmado',
  'order.cancelled': 'Pedido cancelado',
  'user.role_changed': 'Rol actualizado',
  'user.deleted': 'Cuenta eliminada',
  'appearance.updated': 'Tema actualizado',
  'collection.updated': 'Colección actualizada',
  'coupon.created': 'Cupón creado',
  'coupon.status_updated': 'Estado de cupón actualizado',
  'review.moderated': 'Reseña moderada',
  'message.deleted': 'Mensaje eliminado',
  'subscriber.deleted': 'Suscriptor eliminado',
};
const formatDate = (value) => new Date(value).toLocaleString('es-EC');
const formatValue = (value) =>
  value == null ? '—' : typeof value === 'object' ? JSON.stringify(value) : String(value);

function AuditEntries({ url, onPage }) {
  const { data, error, refresh } = useAdminData(url);
  if (error)
    return (
      <section role="alert" className="order-card">
        <p>{error}</p>
        <button className="btn btn-outline" onClick={refresh}>
          Reintentar historial
        </button>
      </section>
    );
  if (!data) return <p role="status">Cargando historial…</p>;
  return (
    <section aria-label="Registros administrativos">
      <p className="text-muted">
        {data.startedAt
          ? `Primer registro disponible: ${formatDate(data.startedAt)}. No se reconstruyen acciones anteriores.`
          : 'El historial comenzará con la próxima acción administrativa registrada.'}
      </p>
      <p role="status">{data.pagination.totalCount} registros encontrados.</p>
      {data.events.length === 0 ? (
        <p className="order-card">No hay acciones para los filtros seleccionados.</p>
      ) : (
        <ol className="review-list">
          {data.events.map((event) => (
            <li key={event._id}>
              <article className="order-card">
                <h2>{actionLabels[event.action] || event.action}</h2>
                <p>
                  <time dateTime={event.createdAt}>{formatDate(event.createdAt)}</time>
                </p>
                <p className="review-text">Responsable (ID): {event.actorId}</p>
                <p className="review-text">
                  Recurso: {event.resourceType} · {event.resourceId}
                </p>
                {event.changes?.length > 0 && (
                  <details>
                    <summary>Ver cambios registrados</summary>
                    <dl className="review-text">
                      {event.changes.map((change, index) => (
                        <div key={`${change.field}-${index}`}>
                          <dt>{change.field}</dt>
                          <dd>
                            {Object.hasOwn(change, 'before') && (
                              <>Antes: {formatValue(change.before)} · </>
                            )}
                            Después: {formatValue(change.after)}
                          </dd>
                        </div>
                      ))}
                    </dl>
                  </details>
                )}
              </article>
            </li>
          ))}
        </ol>
      )}
      <AdminPagination pagination={data.pagination} onPage={onPage} />
      <button type="button" className="btn btn-outline" onClick={refresh}>
        Actualizar historial
      </button>
    </section>
  );
}

function AuditHistory() {
  const [filters, setFilters] = useState({ action: '', from: '', to: '' });
  const [page, setPage] = useState(1);
  const [validationError, setValidationError] = useState('');
  const query = new URLSearchParams({ ...filters, page: String(page) });
  const url = `/api/admin/audit?${query}`;
  return (
    <section className="admin-container container" aria-labelledby="audit-heading">
      <header className="admin-header">
        <h1 id="audit-heading">Historial administrativo</h1>
        <a className="btn btn-outline" href="/admin">
          ← Volver al dashboard
        </a>
      </header>
      <p>
        Consulta las acciones de propietarios y administradores. Los registros son de solo lectura y
        no incluyen contraseñas, tokens ni cuerpos completos de solicitudes.
      </p>
      <form
        className="customer-form order-card"
        onSubmit={(event) => {
          event.preventDefault();
          const form = new FormData(event.currentTarget);
          const next = {
            action: String(form.get('action') || ''),
            from: String(form.get('from') || ''),
            to: String(form.get('to') || ''),
          };
          if (next.from && next.to && next.from > next.to) {
            setValidationError('La fecha inicial no puede ser posterior a la final.');
            return;
          }
          setValidationError('');
          setFilters(next);
          setPage(1);
        }}
      >
        <h2>Filtrar acciones</h2>
        <label htmlFor="audit-action">Acción</label>
        <select id="audit-action" name="action">
          <option value="">Todas las acciones</option>
          {Object.entries(actionLabels).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <label htmlFor="audit-from">Desde</label>
        <input id="audit-from" name="from" type="date" />
        <label htmlFor="audit-to">Hasta</label>
        <input id="audit-to" name="to" type="date" />
        <p className="text-muted">Usa fechas en UTC y un intervalo máximo de 366 días.</p>
        <button className="btn btn-primary" type="submit">
          Filtrar historial
        </button>
        {validationError && <p role="alert">{validationError}</p>}
      </form>
      <AuditEntries key={url} url={url} onPage={setPage} />
    </section>
  );
}

export default function AuditHistoryPage({ user, authReady }) {
  if (!authReady)
    return (
      <p className="products-section" role="status">
        Comprobando acceso…
      </p>
    );
  if (user?.role !== 'owner')
    return (
      <section className="admin-container container">
        <h1>Acceso reservado al propietario</h1>
        <p>El historial administrativo solo está disponible para la cuenta owner.</p>
        <a className="btn btn-outline" href="/admin">
          Volver al dashboard
        </a>
      </section>
    );
  return <AuditHistory />;
}
