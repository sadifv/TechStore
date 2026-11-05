import { useState } from 'react';
import { requestJson } from '../../services/api.js';
import AccountForm from './AccountForm.jsx';

export function ForgotPasswordPage() {
  const [status, setStatus] = useState('');
  const [statusType, setStatusType] = useState('success');
  const [busy, setBusy] = useState(false);
  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setStatus('');
    const form = event.currentTarget;
    try {
      const email = new FormData(form).get('email');
      const result = await requestJson('/api/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ email }),
      });
      setStatusType('success');
      setStatus(result.message);
      form.reset();
    } catch (error) {
      setStatusType('error');
      setStatus(error.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <AccountForm
      title="Recuperar Contraseña"
      description="Ingresa tu correo electrónico y te enviaremos un enlace para restablecerla."
      onSubmit={submit}
      status={status}
      statusType={statusType}
      buttonText="Enviar instrucciones"
      busy={busy}
    >
      <fieldset className="form-group">
        <label htmlFor="forgot-email">Correo Electrónico</label>
        <input
          id="forgot-email"
          type="email"
          name="email"
          required
          autoComplete="email"
          placeholder="correo@ejemplo.com"
        />
      </fieldset>
      <p className="auth-redirect">
        <a href="/login">← Volver al inicio de sesión</a>
      </p>
    </AccountForm>
  );
}
