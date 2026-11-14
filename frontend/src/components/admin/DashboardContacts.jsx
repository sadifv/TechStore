import { AdminPagination } from './AdminPagination.jsx';
import { adminMutation } from '../../services/adminMutation.js';
import { date } from '../../utils/formatters.js';
import { useState } from 'react';
import { useAdminListing } from '../../hooks/useAdminListing.js';

export default function DashboardContacts({
  subscribers,
  subscriberPagination,
  setSubscriberPage,
  refresh,
}) {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const { result, error, loading, reload } = useAdminListing(
    `/api/admin/messages?${new URLSearchParams({ page, q: query })}`,
  );
  const messages = result?.messages || [];
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
      if (kind === 'messages') reload();
      refresh();
    } catch (cause) {
      window.alert(cause.message);
    }
  }

  return (
    <>
      <section className="dashboard-messages">
        <h2 className="section-title">Mensajes de contacto</h2>
        <form
          className="admin-filters"
          onSubmit={(event) => {
            event.preventDefault();
            setPage(1);
            setQuery(search.trim());
          }}
        >
          <label className="form-field">
            Buscar mensajes
            <input
              type="search"
              maxLength={100}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </label>
          <button type="submit" className="btn btn-outline">
            Buscar mensajes
          </button>
          <button
            type="button"
            className="btn btn-outline"
            onClick={() => {
              setSearch('');
              setQuery('');
              setPage(1);
            }}
          >
            Limpiar búsqueda
          </button>
        </form>
        {loading && <p role="status">Cargando mensajes…</p>}
        {error && (
          <p role="alert">
            {error}{' '}
            <button type="button" className="btn btn-outline" onClick={reload}>
              Reintentar
            </button>
          </p>
        )}
        {!loading && !error && (
          <>
            <p role="status">{result?.pagination?.totalCount || 0} mensajes encontrados.</p>
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
            <AdminPagination pagination={result?.pagination} onPage={setPage} />
          </>
        )}
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
    </>
  );
}
