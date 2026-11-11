import { useEffect, useState } from 'react';
import { requestJson } from '../../services/api.js';

let configuration;
export default function WhatsappLink({ phone = false, children, className }) {
  const [config, setConfig] = useState(null);
  useEffect(() => {
    let active = true;
    configuration ||= requestJson('/api/store/config').catch((error) => {
      configuration = undefined;
      throw error;
    });
    configuration
      .then((result) => {
        if (active) setConfig(result);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);
  if (phone)
    return config ? <a href={`tel:+${config.whatsappPhone}`}>+{config.whatsappPhone}</a> : null;
  return config ? (
    <a
      className={className}
      href={config.whatsappUrl}
      target="_blank"
      rel="noreferrer"
      aria-label={children ? undefined : 'WhatsApp'}
    >
      <i className="ri-whatsapp-line" aria-hidden="true" />
      {children}
    </a>
  ) : null;
}
