export function AdminPagination({ pagination, onPage }) {
  if (!pagination || pagination.totalPages <= 1) return null;
  return (
    <nav className="pagination-nav" aria-label="Navegación de páginas">
      <button
        className="btn btn-sm btn-outline"
        type="button"
        disabled={pagination.currentPage <= 1}
        onClick={() => onPage(pagination.currentPage - 1)}
      >
        « Anterior
      </button>
      <span className="pagination-info">
        Página {pagination.currentPage} de {pagination.totalPages}
        {pagination.totalUsers ? ` · ${pagination.totalUsers} usuarios` : ''}
      </span>
      <button
        className="btn btn-sm btn-outline"
        type="button"
        disabled={pagination.currentPage >= pagination.totalPages}
        onClick={() => onPage(pagination.currentPage + 1)}
      >
        Siguiente »
      </button>
    </nav>
  );
}
