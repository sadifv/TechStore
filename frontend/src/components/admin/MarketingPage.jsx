import { useState } from 'react';
import { ADMIN_REFRESH_INTERVAL_MS } from '../../config/requestCadence.js';
import { AdminNotice } from './AdminNotice.jsx';
import { adminMutation } from '../../services/adminMutation.js';
import { date, money } from '../../utils/formatters.js';
import { useAdminData } from '../../hooks/useAdminData.js';

const campaignStatusLabel = (campaign) => {
  if (campaign.errorCode === 'NO_SUBSCRIBERS') return 'Fallida: sin suscriptores activos';
  if (campaign.errorCode === 'CAMPAIGN_RECIPIENT_LIMIT')
    return 'Fallida: supera 1000 destinatarios';
  if (campaign.errorCode === 'DELIVERY_OUTCOME_UNKNOWN')
    return 'Interrumpida: revisa los envíos fallidos antes de reintentar';
  return (
    {
      queued: 'En cola',
      sending: 'Envío en curso',
      sent: 'Enviada',
      simulated: 'Simulada',
      partial: 'Parcial',
      failed: 'Fallida',
    }[campaign.status] || campaign.status
  );
};

export function AdminMarketingPage() {
  const { data, error, refresh } = useAdminData('/api/admin/marketing', {
    refreshIntervalMs: ADMIN_REFRESH_INTERVAL_MS,
  });
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  const coupons = data?.coupons || [];
  const campaigns = data?.campaigns || [];
  async function createCoupon(event) {
    event.preventDefault();
    setBusy(true);
    setStatus('');
    const target = event.currentTarget;
    const form = new FormData(target);
    try {
      const result = await adminMutation('/api/admin/coupons', {
        method: 'POST',
        body: JSON.stringify(Object.fromEntries(form.entries())),
      });
      setStatus(`Cupón ${result.coupon.code} guardado.`);
      target.reset();
      refresh();
    } catch (cause) {
      setStatus(cause.message);
    } finally {
      setBusy(false);
    }
  }
  async function sendCampaign(event) {
    event.preventDefault();
    if (
      !window.confirm(
        'La campaña se enviará en segundo plano al público seleccionado. ¿Quieres continuar?',
      )
    )
      return;
    const formData = Object.fromEntries(new FormData(event.currentTarget).entries());
    setBusy(true);
    setStatus('Agregando campaña a la cola…');
    try {
      const result = await adminMutation('/api/admin/campaigns', {
        method: 'POST',
        body: JSON.stringify(formData),
      });
      setStatus(result.message);
      refresh();
    } catch (cause) {
      setStatus(cause.message);
    } finally {
      setBusy(false);
    }
  }
  async function sendCampaignTest(event) {
    const formData = new FormData(event.currentTarget.form);
    const payload = Object.fromEntries(formData.entries());
    if (!String(payload.subject || '').trim() || !String(payload.content || '').trim()) {
      setStatus('Completa el asunto y el mensaje antes de enviar la prueba.');
      return;
    }

    setBusy(true);
    setStatus('Enviando una prueba a la cuenta administrativa…');
    try {
      const result = await adminMutation('/api/admin/campaigns/test', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      setStatus(result.message);
    } catch (cause) {
      setStatus(cause.message);
    } finally {
      setBusy(false);
    }
  }
  async function toggleCoupon(coupon) {
    try {
      await adminMutation(`/api/admin/coupons/${coupon._id}/status`, { method: 'PATCH' });
      refresh();
    } catch (cause) {
      setStatus(cause.message);
    }
  }
  if (error) return <AdminNotice error={error} />;
  if (!data)
    return (
      <section className="admin-container container">
        <p role="status">Cargando marketing…</p>
      </section>
    );
  return (
    <section className="admin-container container admin-marketing">
      <header className="admin-header">
        <h1>Marketing y cupones</h1>
        <a href="/admin/dashboard" className="btn btn-outline">
          Volver al dashboard
        </a>
      </header>
      <section className="marketing-grid">
        <article className="admin-marketing-card">
          <h2>Crear cupón</h2>
          <form className="admin-marketing-form" onSubmit={createCoupon}>
            <label>
              Código
              <input
                name="code"
                required
                minLength="4"
                maxLength="32"
                pattern="[A-Za-z0-9_-]+"
                placeholder="VERANO10"
              />
            </label>
            <label>
              Descuento (%)
              <input
                name="discountPercent"
                type="number"
                min="1"
                max="100"
                required
                defaultValue="10"
              />
            </label>
            <label>
              Descuento máximo ($)
              <input
                name="maxDiscountAmount"
                type="number"
                min="0.01"
                step="0.01"
                required
                defaultValue="8"
              />
            </label>
            <label>
              Compra mínima ($)
              <input
                name="minOrderAmount"
                type="number"
                min="0"
                step="0.01"
                required
                defaultValue="50"
              />
            </label>
            <label>
              Usos máximos
              <input name="maxRedemptions" type="number" min="1" step="1" />
            </label>
            <label>
              Vence
              <input name="expiresAt" type="datetime-local" />
            </label>
            <label className="marketing-form-wide">
              Descripción
              <input name="description" maxLength="200" />
            </label>
            <button className="btn btn-primary" disabled={busy}>
              Guardar cupón
            </button>
          </form>
        </article>
        <article className="admin-marketing-card">
          <h2>Enviar campaña</h2>
          <p>
            El envío respeta las bajas y usa el transporte de correo configurado en el backend. Si no
            está disponible, la campaña quedará fallida en producción; en desarrollo puede quedar
            registrada como simulada.
          </p>
          <p>
            La prueba se envía solo al correo de la cuenta administrativa con sesión iniciada. No
            incluye suscriptores ni crea una campaña. Gmail debe aceptar el mensaje; revisa también
            la carpeta de spam.
          </p>
          <form className="admin-marketing-form" onSubmit={sendCampaign}>
            <label>
              Nombre interno
              <input name="name" required maxLength="100" />
            </label>
            <label>
              Asunto del correo
              <input name="subject" required maxLength="150" />
            </label>
            <label>
              Público
              <select name="audience">
                <option value="newsletter">Boletín gratuito</option>
              </select>
            </label>
            <label>
              Cupón
              <select name="couponCode">
                <option value="">Sin cupón</option>
                {coupons
                  .filter((coupon) => coupon.active)
                  .map((coupon) => (
                    <option key={coupon._id} value={coupon.code}>
                      {coupon.code}
                    </option>
                  ))}
              </select>
            </label>
            <label className="marketing-form-wide">
              Mensaje
              <textarea name="content" required maxLength="5000" rows="6" />
            </label>
            <button
              type="button"
              className="btn btn-outline"
              disabled={busy}
              onClick={sendCampaignTest}
            >
              Enviar prueba a mi cuenta
            </button>
            <button className="btn btn-primary" disabled={busy}>
              Enviar campaña
            </button>
          </form>
        </article>
      </section>
      {status && (
        <output
          className={`form-status ${status.includes('Error') || status.includes('No se') ? 'error' : 'success'}`}
          role="status"
        >
          {status}
        </output>
      )}
      <section className="admin-marketing-card">
        <h2>Cupones</h2>
        <div className="admin-table-wrapper">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Código</th>
                <th>Descuento</th>
                <th>Mínimo</th>
                <th>Usos</th>
                <th>Vencimiento</th>
                <th>Estado</th>
                <th>Acción</th>
              </tr>
            </thead>
            <tbody>
              {coupons.map((coupon) => (
                <tr key={coupon._id}>
                  <td>
                    <strong>{coupon.code}</strong>
                  </td>
                  <td>
                    {coupon.discountPercent}% (máx. {money(coupon.maxDiscountAmount)})
                  </td>
                  <td>{money(coupon.minOrderAmount)}</td>
                  <td>
                    {coupon.redemptionCount}
                    {coupon.maxRedemptions ? ` / ${coupon.maxRedemptions}` : ''}
                  </td>
                  <td>{date(coupon.expiresAt)}</td>
                  <td>{coupon.active ? 'Activo' : 'Pausado'}</td>
                  <td>
                    <button
                      type="button"
                      className="btn btn-sm btn-outline"
                      onClick={() => toggleCoupon(coupon)}
                    >
                      {coupon.active ? 'Pausar' : 'Activar'}
                    </button>
                  </td>
                </tr>
              ))}
              {!coupons.length && (
                <tr>
                  <td colSpan="7">Aún no hay cupones.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
      <section className="admin-marketing-card">
        <h2>Historial de campañas</h2>
        <div className="admin-table-wrapper">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Público</th>
                <th>Estado</th>
                <th>Destinatarios</th>
                <th>Fecha</th>
              </tr>
            </thead>
            <tbody>
              {campaigns.map((campaign) => (
                <tr key={campaign._id}>
                  <td>{campaign.name}</td>
                  <td>{campaign.audience}</td>
                  <td>{campaignStatusLabel(campaign)}</td>
                  <td>
                    {campaign.recipientCount} · {campaign.sentCount} enviados ·{' '}
                    {campaign.failedCount} fallidos{campaign.simulated ? ' · simulado' : ''}
                  </td>
                  <td>{date(campaign.createdAt, { dateStyle: 'short', timeStyle: 'short' })}</td>
                </tr>
              ))}
              {!campaigns.length && (
                <tr>
                  <td colSpan="5">Aún no hay campañas.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </section>
  );
}
