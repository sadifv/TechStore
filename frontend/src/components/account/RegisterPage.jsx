import { useState } from 'react';
import { requestJson } from '../../services/api.js';
import AccountForm from './AccountForm.jsx';
import { safeReturnTo } from '../../services/api.js';
import CredentialsFields from './CredentialsFields.jsx';

export function RegisterPage() {
  const [status, setStatus] = useState('');
  const [statusType, setStatusType] = useState('error');
  const [busy, setBusy] = useState(false);
  const next = safeReturnTo(new URLSearchParams(location.search).get('next'));
  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setStatus('');
    setStatusType('error');
    const form = event.currentTarget;
    const data = Object.fromEntries(new FormData(form).entries());
    try {
      const result = await requestJson('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify(data),
      });
      setStatusType('success');
      setStatus(result.message);
      form.reset();
    } catch (error) {
      setStatus(error.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <AccountForm
      title="Crear Cuenta"
      description="Confirma tu correo para activar tu cuenta y elegir tu contraseña."
      onSubmit={submit}
      status={status}
      statusType={statusType}
      buttonText="Crear Cuenta"
      busy={busy}
    >
      <CredentialsFields register next={next} />
    </AccountForm>
  );
}
