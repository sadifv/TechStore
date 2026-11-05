import { useState } from 'react';
import { requestJson } from '../../services/api.js';
import AccountForm from './AccountForm.jsx';
import PasswordInput from './PasswordInput.jsx';

export function ResetPasswordPage({ token }) {
  const [status, setStatus] = useState('');
  const [statusType, setStatusType] = useState('error');
  const [busy, setBusy] = useState(false);
  async function submit(event) {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.currentTarget).entries());
    if (data.password !== data.confirmPassword) {
      setStatus('Las contraseñas no coinciden.');
      return;
    }
    setBusy(true);
    setStatus('');
    try {
      const result = await requestJson(`/api/auth/reset-password/${encodeURIComponent(token)}`, {
        method: 'POST',
        body: JSON.stringify({ password: data.password }),
      });
      setStatusType('success');
      setStatus(result.message);
      setTimeout(() => location.assign('/login'), 1800);
    } catch (error) {
      setStatusType('error');
      setStatus(error.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <AccountForm
      title="Nueva Contraseña"
      description="Ingresa y confirma tu nueva contraseña."
      onSubmit={submit}
      status={status}
      statusType={statusType}
      buttonText="Guardar Contraseña"
      busy={busy}
    >
      <fieldset className="form-group">
        <label htmlFor="new-password">Nueva Contraseña</label>
        <PasswordInput
          id="new-password"
          label="nueva contraseña"
          name="password"
          required
          minLength="12"
          maxLength="100"
          autoComplete="new-password"
        />
      </fieldset>
      <fieldset className="form-group">
        <label htmlFor="confirm-password">Confirmar Contraseña</label>
        <PasswordInput
          id="confirm-password"
          label="confirmación de contraseña"
          name="confirmPassword"
          required
          minLength="12"
          maxLength="100"
          autoComplete="new-password"
        />
      </fieldset>
    </AccountForm>
  );
}
