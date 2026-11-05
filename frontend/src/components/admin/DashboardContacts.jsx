import { AdminPagination } from './AdminPagination.jsx';
import { adminMutation } from '../../services/adminMutation.js';
import { date } from '../../utils/formatters.js';

export default function DashboardContacts({
  messages,
  subscribers,
  subscriberPagination,
  setSubscriberPage,
  refresh,
}) {
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

  return (
    <>
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
    </>
  );
}
