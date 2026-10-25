import { useState } from 'react';

export default function PasswordInput({ id, label = 'contraseña', ...props }) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="password-field">
      <input {...props} id={id} type={visible ? 'text' : 'password'} />
      <button
        type="button"
        className="password-toggle"
        aria-controls={id}
        aria-label={`Mostrar ${label}`}
        aria-pressed={visible}
        onClick={() => setVisible((value) => !value)}
      >
        <span aria-hidden="true">{visible ? 'Ocultar' : 'Mostrar'}</span>
      </button>
    </div>
  );
}
