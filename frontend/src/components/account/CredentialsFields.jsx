import PasswordInput from './PasswordInput.jsx';

export default function CredentialsFields({ register = false, next }) {
  return (
    <>
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
      {!register && (
        <>
          <fieldset className="form-group">
            <label htmlFor="auth-password">Contraseña</label>
            <PasswordInput
              id="auth-password"
              name="password"
              maxLength="100"
              required
              autoComplete="current-password"
              placeholder="••••••••"
            />
          </fieldset>
          <p className="auth-forgot-link">
            <a className="link-secondary" href="/forgot-password">
              ¿Olvidaste tu contraseña?
            </a>
          </p>
        </>
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
    </>
  );
}
