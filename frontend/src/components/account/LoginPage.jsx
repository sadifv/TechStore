import { useEffect, useRef, useState } from 'react';
import { requestJson, safeReturnTo } from '../../services/api.js';
import { getAdminMfaStep } from './adminMfaFlow.js';
import AccountForm from './AccountForm.jsx';
import CredentialsFields from './CredentialsFields.jsx';

export function LoginPage() {
  const [status, setStatus] = useState('');
  const [statusType, setStatusType] = useState('error');
  const [busy, setBusy] = useState(false);
  const [mfaStep, setMfaStep] = useState(null);
  const [mfaSetup, setMfaSetup] = useState(null);
  const [recoveryCodes, setRecoveryCodes] = useState([]);
  const mfaHeadingRef = useRef(null);
  const next = safeReturnTo(new URLSearchParams(location.search).get('next'));

  useEffect(() => {
    if (mfaStep) requestAnimationFrame(() => mfaHeadingRef.current?.focus());
  }, [mfaStep]);

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setStatus('');
    setStatusType('error');
    const data = Object.fromEntries(new FormData(event.currentTarget).entries());
    try {
      const result = await requestJson('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify(data),
      });
      const adminMfaStep = getAdminMfaStep(result);
      if (adminMfaStep === 'enroll') {
        const setup = await requestJson('/api/auth/admin/mfa/enroll', {
          method: 'POST',
          body: '{}',
        });
        setMfaSetup(setup);
        setMfaStep('enroll');
        setStatus('Configura una aplicación autenticadora y confirma el código para activar MFA.');
        setStatusType('success');
        return;
      }
      if (adminMfaStep === 'verify') {
        setMfaStep('verify');
        setStatus('Ingresa el código de tu aplicación autenticadora o un código de recuperación.');
        setStatusType('success');
        return;
      }
      location.assign(next);
    } catch (error) {
      setStatus(error.message);
    } finally {
      setBusy(false);
    }
  }

  async function submitMfa(event) {
    event.preventDefault();
    setBusy(true);
    setStatus('');
    const data = Object.fromEntries(new FormData(event.currentTarget).entries());
    const endpoint =
      mfaStep === 'enroll' ? '/api/auth/admin/mfa/confirm' : '/api/auth/admin/mfa/verify';
    try {
      const result = await requestJson(endpoint, { method: 'POST', body: JSON.stringify(data) });
      if (getAdminMfaStep(result) === 'enroll') {
        const setup = await requestJson('/api/auth/admin/mfa/enroll', {
          method: 'POST',
          body: '{}',
        });
        setMfaSetup(setup);
        setMfaStep('enroll');
        setStatus('Vuelve a configurar la aplicación autenticadora y confirma el nuevo código.');
        setStatusType('success');
        return;
      }
      if (mfaStep === 'enroll') {
        setRecoveryCodes(result.recoveryCodes || []);
        setMfaStep('codes');
        setStatus('Guarda estos códigos en un lugar seguro; solo se mostrarán ahora.');
        setStatusType('success');
        return;
      }
      location.assign(next);
    } catch (error) {
      setStatus(error.message);
      setStatusType('error');
    } finally {
      setBusy(false);
    }
  }

  if (mfaStep) {
    if (mfaStep === 'codes') {
      return (
        <AccountForm
          title="Guarda tus códigos de recuperación"
          description="Cada código se puede usar una sola vez."
          onSubmit={(event) => {
            event.preventDefault();
            location.assign(next);
          }}
          status={status}
          statusType="success"
          buttonText="Ya los guardé"
          busy={false}
          headingRef={mfaHeadingRef}
        >
          <ul aria-label="Códigos de recuperación" className="mfa-recovery-codes">
            {recoveryCodes.map((code) => (
              <li key={code}>
                <code>{code}</code>
              </li>
            ))}
          </ul>
        </AccountForm>
      );
    }
    const enrollment = mfaStep === 'enroll';
    return (
      <AccountForm
        title={enrollment ? 'Configura la verificación en dos pasos' : 'Verifica tu identidad'}
        description={
          enrollment
            ? 'Agrega este secreto en una aplicación autenticadora. No compartas la pantalla.'
            : 'La sesión administrativa se activará después de verificar el segundo factor.'
        }
        onSubmit={submitMfa}
        status={status}
        statusType={statusType}
        buttonText={enrollment ? 'Activar MFA' : 'Verificar'}
        busy={busy}
        headingRef={mfaHeadingRef}
      >
        {enrollment && mfaSetup && (
          <fieldset className="form-group">
            <legend id="mfa-secret-label">Secreto para la aplicación autenticadora</legend>
            <code aria-labelledby="mfa-secret-label" className="mfa-secret">
              {mfaSetup.secret}
            </code>
            <details>
              <summary>URI de configuración manual</summary>
              <code className="mfa-secret">{mfaSetup.otpauthUri}</code>
            </details>
          </fieldset>
        )}
        <fieldset className="form-group">
          <label htmlFor="mfa-code">
            {enrollment ? 'Código de 6 dígitos' : 'Código de autenticación'}
          </label>
          <input
            id="mfa-code"
            name="code"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]{6}"
            maxLength="6"
            required={enrollment}
          />
        </fieldset>
        {!enrollment && (
          <fieldset className="form-group">
            <label htmlFor="mfa-recovery">
              Código de recuperación (si no tienes la aplicación)
            </label>
            <input id="mfa-recovery" name="recoveryCode" autoComplete="off" />
          </fieldset>
        )}
        <button
          className="link-secondary"
          type="button"
          onClick={() =>
            location.assign(`/login${next !== '/' ? `?next=${encodeURIComponent(next)}` : ''}`)
          }
        >
          Volver al inicio de sesión
        </button>
      </AccountForm>
    );
  }

  return (
    <AccountForm
      title="Iniciar Sesión"
      onSubmit={submit}
      status={status}
      statusType={statusType}
      buttonText="Ingresar"
      busy={busy}
    >
      <CredentialsFields next={next} />
    </AccountForm>
  );
}
