import { useState } from 'react';
import { requestJson } from '../../services/api.js';
import PasswordInput from './PasswordInput.jsx';

function IdentityFields({ prefix, staff }) {
  return (
    <>
      <label htmlFor={`${prefix}-current`}>Contraseña actual</label>
      <PasswordInput id={`${prefix}-current`} label="contraseña actual" name="currentPassword" autoComplete="current-password" required maxLength={100} />
      {staff && <>
        <label htmlFor={`${prefix}-code`}>Código nuevo de tu aplicación autenticadora</label>
        <input id={`${prefix}-code`} name="code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required />
        <p>Por seguridad, cada operación requiere un código MFA que no hayas utilizado. Si acabas de iniciar sesión, espera al siguiente código.</p>
      </>}
    </>
  );
}

export default function AccountSecuritySection({ user }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [emailPending, setEmailPending] = useState(false);
  const staff = ['admin', 'owner'].includes(user.role);

  async function submit(event, operation) {
    event.preventDefault();
    if (busy) return;
    const form = event.currentTarget;
    const body = Object.fromEntries(new FormData(form));
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const result = await requestJson(`/api/auth/account/${operation}`, {
        method: operation === 'name' ? 'PATCH' : 'POST', body: JSON.stringify(body),
      });
      form.reset();
      if (result.signInRequired) {
        location.assign('/login?next=%2Fprofile&accountUpdated=1');
        return;
      }
      if (operation === 'name') window.dispatchEvent(new Event('account-updated'));
      if (operation === 'email') setEmailPending(true);
      setMessage(result.message || 'Nombre actualizado.');
    } catch (cause) {
      setError(cause.message);
    } finally {
      // Do not keep passwords, codes or verification tokens after any attempt.
      form.querySelectorAll('input[name="currentPassword"], input[name="password"], input[name="code"], input[name="token"]')
        .forEach((input) => { input.value = ''; });
      setBusy(false);
    }
  }

  return (
    <section className="account-security" aria-labelledby="account-security-heading" aria-busy={busy}>
      <h2 id="account-security-heading">Datos y seguridad</h2>
      <p>Los cambios de correo y contraseña cierran las sesiones anteriores. No modifican pedidos ni roles.</p>
      <details>
        <summary>Editar nombre</summary>
        <form className="customer-form" onSubmit={(event) => submit(event, 'name')}>
          <fieldset disabled={busy}>
            <legend>Nombre de tu cuenta</legend>
            <label htmlFor="account-name">Nombre</label>
            <input id="account-name" name="name" autoComplete="name" defaultValue={user.name} minLength={2} maxLength={80} required />
            <button className="btn btn-primary" type="submit">Guardar nombre</button>
          </fieldset>
        </form>
      </details>
      <details>
        <summary>Cambiar contraseña</summary>
        <form className="customer-form" onSubmit={(event) => submit(event, 'password')}>
          <fieldset disabled={busy}>
            <legend>Confirma tu identidad</legend>
            <IdentityFields prefix="account-password" staff={staff} />
            <label htmlFor="account-new-password">Nueva contraseña</label>
            <PasswordInput id="account-new-password" label="nueva contraseña" name="password" minLength={12} maxLength={72} autoComplete="new-password" required />
            <p>Al menos 12 caracteres y como máximo 72 bytes UTF-8.</p>
            <button className="btn btn-primary" type="submit">Guardar contraseña</button>
          </fieldset>
        </form>
      </details>
      <details>
        <summary>Cambiar correo</summary>
        <p>Correo actual: {user.email}. Se conserva hasta confirmar el nuevo.</p>
        <form className="customer-form" onSubmit={(event) => submit(event, emailPending ? 'email/confirm' : 'email')}>
          <fieldset disabled={busy}>
            <legend>{emailPending ? 'Confirma el nuevo correo' : 'Solicita la verificación'}</legend>
            {!emailPending ? <>
              <label htmlFor="account-email">Nuevo correo</label>
              <input id="account-email" name="email" type="email" maxLength={254} autoComplete="email" required />
            </> : <>
              <label htmlFor="account-email-token">Código recibido en el nuevo correo</label>
              <input id="account-email-token" name="token" minLength={64} maxLength={64} pattern="[a-f0-9]{64}" autoComplete="off" spellCheck={false} required />
              <p>Pega el código completo. Caduca en 15 minutos y solo sirve una vez.</p>
            </>}
            <IdentityFields prefix="account-email-identity" staff={staff} />
            <button className="btn btn-primary" type="submit">{emailPending ? 'Confirmar nuevo correo' : 'Enviar código al nuevo correo'}</button>
            <button className="btn btn-outline" type="button" onClick={() => { setEmailPending(!emailPending); setError(''); setMessage(''); }}>
              {emailPending ? 'Solicitar otro código' : 'Ya tengo un código'}
            </button>
          </fieldset>
        </form>
      </details>
      {message && <p role="status">{message}</p>}
      {error && <p className="form-status error" role="alert">{error}</p>}
    </section>
  );
}
