import { useState } from 'react';
import { requestJson, safeReturnTo } from '../../api.js';

function AccountForm({
  title,
  description,
  children,
  onSubmit,
  status,
  statusType = 'error',
  buttonText,
  busy,
}) {
  return (
    <section className="login-container container" aria-label={title}>
      <article className="login-card">
        <h1>{title}</h1>
        {description && <p className="auth-description">{description}</p>}
        <form className="auth-form" onSubmit={onSubmit}>
          {children}
          <button className="btn btn-primary" type="submit" disabled={busy}>
            {busy ? 'Procesando…' : buttonText}
          </button>
          {status && (
            <output className={`form-status ${statusType}`} aria-live="polite">
              {status}
            </output>
          )}
        </form>
      </article>
    </section>
  );
}

function AuthPage({ register = false }) {
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  const next = safeReturnTo(new URLSearchParams(location.search).get('next'));

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setStatus('');
    const data = Object.fromEntries(new FormData(event.currentTarget).entries());
    try {
      await requestJson(register ? '/api/auth/register' : '/api/auth/login', {
        method: 'POST',
        body: JSON.stringify(data),
      });
      location.assign(next);
    } catch (error) {
      setStatus(error.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <AccountForm
      title={register ? 'Crear Cuenta' : 'Iniciar Sesión'}
      description={register ? 'Regístrate para comenzar a comprar en TechStore.' : undefined}
      onSubmit={submit}
      status={status}
      buttonText={register ? 'Crear Cuenta' : 'Ingresar'}
      busy={busy}
    >
      {register && (
        <fieldset className="form-group">
          <label htmlFor="auth-name">Nombre Completo</label>
          <input
            id="auth-name"
            name="name"
            type="text"
            required
            minLength="2"
            autoComplete="name"
            placeholder="Tu nombre"
          />
        </fieldset>
      )}
      <fieldset className="form-group">
        <label htmlFor="auth-email">Correo Electrónico</label>
        <input
          id="auth-email"
          name="email"
          type="email"
          required
          autoComplete="email"
          placeholder="correo@ejemplo.com"
        />
      </fieldset>
      <fieldset className="form-group">
        <label htmlFor="auth-password">Contraseña</label>
        <input
          id="auth-password"
          name="password"
          type="password"
          minLength={register ? 12 : undefined}
          maxLength="100"
          required
          autoComplete={register ? 'new-password' : 'current-password'}
          placeholder="••••••••"
        />
        {register && <small>Usa al menos 12 caracteres.</small>}
      </fieldset>
      {!register && (
        <p className="auth-forgot-link">
          <a className="link-secondary" href="/forgot-password">
            ¿Olvidaste tu contraseña?
          </a>
        </p>
      )}
      <p className="auth-redirect">
        {register ? '¿Ya tienes una cuenta?' : '¿No tienes una cuenta?'}{' '}
        <a
          href={
            register
              ? `/login${next !== '/' ? `?next=${encodeURIComponent(next)}` : ''}`
              : `/register${next !== '/' ? `?next=${encodeURIComponent(next)}` : ''}`
          }
        >
          {register ? 'Inicia sesión aquí' : 'Regístrate aquí'}
        </a>
      </p>
    </AccountForm>
  );
}

export function LoginPage() {
  return <AuthPage />;
}
export function RegisterPage() {
  return <AuthPage register />;
}

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
        <input
          id="new-password"
          type="password"
          name="password"
          required
          minLength="12"
          maxLength="100"
          autoComplete="new-password"
        />
      </fieldset>
      <fieldset className="form-group">
        <label htmlFor="confirm-password">Confirmar Contraseña</label>
        <input
          id="confirm-password"
          type="password"
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
