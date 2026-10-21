import { Component } from 'react';

export default class AppErrorBoundary extends Component {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <main className="container products-section">
        <h1>No pudimos cargar esta página</h1>
        <p role="alert">Ocurrió un error. Puedes recargar la página o volver al inicio.</p>
        <button type="button" className="btn btn-primary" onClick={() => window.location.reload()}>
          Recargar página
        </button>
        <a href="/" className="btn btn-secondary">
          Volver al inicio
        </a>
      </main>
    );
  }
}
