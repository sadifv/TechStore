import { lazy, Suspense } from 'react';

const Content = lazy(() => import('./StoreContentSettings.jsx'));
const Categories = lazy(() => import('./CategorySettings.jsx'));
const Collections = lazy(() => import('./CollectionSettings.jsx'));
const editors = {
  content: {
    title: 'Contenido de la tienda',
    description: 'Edita los textos y datos públicos. Revisa el borrador antes de guardar.',
    Component: Content,
  },
  categories: {
    title: 'Administrar categorías',
    description:
      'Organiza las categorías, sus nombres e imágenes sin cambiar el historial de compras.',
    Component: Categories,
  },
  collections: {
    title: 'Colecciones de la portada',
    description: 'Prepara selecciones de productos y decide cuándo aparecen en la tienda.',
    Component: Collections,
  },
};

export default function StoreEditorPage({ kind }) {
  const { title, description, Component } = editors[kind];
  return (
    <section
      className="admin-container container admin-editor-page"
      aria-labelledby="store-editor-heading"
    >
      <header className="admin-header">
        <h1 id="store-editor-heading">{title}</h1>
        <p>{description}</p>
        <a className="btn btn-outline" href="/admin/dashboard">
          ← Volver al panel
        </a>
      </header>
      <Suspense fallback={<p role="status">Cargando editor…</p>}>
        <Component standalone />
      </Suspense>
    </section>
  );
}
