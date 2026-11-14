import useConfirmation from '../../hooks/useConfirmation.js';
import { useEffect, useState } from 'react';
import { requestJson } from '../../services/api.js';
import { adminMutation } from '../../services/adminMutation.js';
import useStoreContent from '../../hooks/useStoreContent.js';
import defaults from '../../config/storeContentDefaults.json';

const groups = [
  [
    'Datos del negocio',
    [
      ['email', 'Correo público', 'email'],
      ['location', 'Ubicación'],
      ['hours', 'Horario'],
      ['instagram', 'Perfil de Instagram (vacío para ocultarlo)', 'url'],
      ['footerText', 'Descripción del pie'],
    ],
  ],
  [
    'Portada',
    [
      ['heroLead', 'Titular'],
      ['heroAccent', 'Palabra destacada'],
      ['heroSubtitle', 'Descripción de portada'],
      ['heroImage', 'Imagen principal'],
      ['heroDetailImage', 'Imagen de detalle'],
      ['heroImageAlt', 'Descripción de la imagen'],
      ...[1, 2, 3].flatMap((n) => [
        [`chapter${n}Title`, `Título del capítulo ${n}`],
        [`chapter${n}Text`, `Texto del capítulo ${n}`],
      ]),
    ],
  ],
  [
    'Sección de componentes',
    [
      ['buildTitle', 'Título de componentes'],
      ['buildSubtitle', 'Segunda línea'],
      ['buildText', 'Descripción de componentes'],
      ['buildImage', 'Imagen de componentes (vacío para usar la ilustración)'],
      ['buildImageAlt', 'Descripción de la imagen de componentes'],
    ],
  ],
  [
    'Contacto',
    [
      ['contactTitle', 'Título de contacto'],
      ['contactText', 'Introducción de contacto'],
    ],
  ],
];
const limit = (key) =>
  key.endsWith('Image') || key === 'instagram'
    ? 500
    : key === 'email'
      ? 254
      : key.endsWith('Text') || ['heroSubtitle', 'buildText', 'contactText'].includes(key)
        ? 240
        : 120;

function ContentForm() {
  const confirm = useConfirmation({
    title: 'Descartar cambios',
    confirmLabel: 'Descartar y recargar',
    danger: true,
  });
  const { setContent } = useStoreContent();
  const [draft, setDraft] = useState(null);
  const [revision, setRevision] = useState(0);
  const [load, setLoad] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  useEffect(() => {
    const controller = new AbortController();
    requestJson('/api/admin/content', { signal: controller.signal })
      .then((result) => {
        if (controller.signal.aborted) return;
        setDraft({ ...defaults, ...result.content });
        setRevision(result.revision);
        setLoading(false);
      })
      .catch((cause) => {
        if (!controller.signal.aborted) {
          setError(cause.message);
          setLoading(false);
        }
      });
    return () => controller.abort();
  }, [load]);
  async function save(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const result = await adminMutation('/api/admin/content', {
        method: 'PATCH',
        body: JSON.stringify({ content: draft, revision }),
      });
      setRevision(result.revision);
      setContent({ ...draft });
      setMessage('Contenido guardado. Los visitantes lo verán al cargar la tienda.');
    } catch (cause) {
      setError(cause.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="store-content-editor">
      <p>
        Solo texto y direcciones de imágenes HTTPS o locales. No admite HTML, CSS ni scripts.
        Cambiar el correo público no cambia la configuración de envío de mensajes.
      </p>
      <p>
        La vista previa no publica cambios. Si cambias las imágenes del hero, prepara una pareja
        coherente: se conservan las tres escenas y se ocultan las etiquetas específicas de
        auriculares.
      </p>
      {error && (
        <p role="alert" className="form-status error">
          {error}
        </p>
      )}
      <button
        className="btn btn-outline"
        type="button"
        disabled={busy || loading}
        onClick={async () => {
          if (
            draft &&
            !(await confirm('Recargar descarta los cambios de este formulario. ¿Continuar?'))
          )
            return;
          setLoading(true);
          setError('');
          setMessage('');
          setLoad((value) => value + 1);
        }}
      >
        Recargar contenido guardado
      </button>
      {loading && <p role="status">Cargando contenido…</p>}
      {draft && !loading && (
        <>
          <form onSubmit={save}>
            <fieldset disabled={busy}>
              <legend className="sr-only">Editar contenido de la tienda</legend>
              {groups.map(([title, fields]) => (
                <fieldset key={title} className="store-content-fields">
                  <legend>{title}</legend>
                  {fields.map(([key, label, type = 'text']) => (
                    <p className="form-field" key={key}>
                      <label htmlFor={`content-${key}`}>{label}</label>
                      {key.endsWith('Text') ||
                      ['heroSubtitle', 'buildText', 'contactText'].includes(key) ? (
                        <textarea
                          id={`content-${key}`}
                          rows={3}
                          maxLength={limit(key)}
                          required
                          value={draft[key]}
                          onChange={(event) => {
                            setDraft({ ...draft, [key]: event.target.value });
                            setMessage('');
                          }}
                        />
                      ) : (
                        <input
                          id={`content-${key}`}
                          type={type}
                          maxLength={limit(key)}
                          required={!['instagram', 'buildImage'].includes(key)}
                          value={draft[key]}
                          onChange={(event) => {
                            setDraft({ ...draft, [key]: event.target.value });
                            setMessage('');
                          }}
                        />
                      )}
                    </p>
                  ))}
                </fieldset>
              ))}
              <button className="btn btn-primary" type="submit">
                {busy ? 'Guardando…' : 'Guardar contenido de la tienda'}
              </button>
            </fieldset>
            <p role="status">{message}</p>
          </form>
          <section className="store-content-preview" aria-labelledby="content-preview-heading">
            <h3 id="content-preview-heading">Vista previa del contenido sin publicar</h3>
            <article>
              <h4>
                {draft.heroLead} <em>{draft.heroAccent}</em>
              </h4>
              <p>{draft.heroSubtitle}</p>
              <img
                src={draft.heroImage}
                alt={draft.heroImageAlt}
                width="640"
                height="320"
                loading="lazy"
              />
              <ol>
                {[1, 2, 3].map((n) => (
                  <li key={n}>
                    <strong>{draft[`chapter${n}Title`]}</strong>
                    <p>{draft[`chapter${n}Text`]}</p>
                  </li>
                ))}
              </ol>
            </article>
            <article>
              <h4>
                {draft.buildTitle} {draft.buildSubtitle}
              </h4>
              <p>{draft.buildText}</p>
              {draft.buildImage && (
                <img
                  src={draft.buildImage}
                  alt={draft.buildImageAlt}
                  width="640"
                  height="560"
                  loading="lazy"
                />
              )}
            </article>
            <article>
              <h4>{draft.contactTitle}</h4>
              <p>{draft.contactText}</p>
              <p>{draft.email}</p>
              <p>{draft.location}</p>
              <p>{draft.hours}</p>
              <p>{draft.footerText}</p>
            </article>
          </section>
        </>
      )}
    </div>
  );
}

export default function StoreContentSettings({ standalone = false }) {
  const [visited, setVisited] = useState(false);
  if (standalone)
    return (
      <section
        className="collection-settings admin-settings-panel"
        aria-label="Editor de contenido"
      >
        <ContentForm />
      </section>
    );
  return (
    <details
      className="collection-settings"
      onToggle={(event) => {
        if (event.currentTarget.open) setVisited(true);
      }}
    >
      <summary>Contenido de la tienda</summary>
      {visited && <ContentForm />}
    </details>
  );
}
