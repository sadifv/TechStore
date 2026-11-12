import { useState } from 'react';
import { ADMIN_REFRESH_INTERVAL_MS } from '../../config/requestCadence.js';
import { AdminNotice } from './AdminNotice.jsx';
import { AdminPagination } from './AdminPagination.jsx';
import { adminMutation } from '../../services/adminMutation.js';
import { date } from '../../utils/formatters.js';
import { useAdminData } from '../../hooks/useAdminData.js';

export function AdminUsersPage() {
  const query = new URLSearchParams(location.search);
  const [search, setSearch] = useState(query.get('search') || '');
  const [role, setRole] = useState(query.get('role') || '');
  const [page, setPage] = useState(Number(query.get('page')) || 1);
  const [filter, setFilter] = useState({ search, role });
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const { data, error, refresh } = useAdminData(
    `/api/admin/users?page=${page}&search=${encodeURIComponent(filter.search)}&role=${encodeURIComponent(filter.role)}`,
    { refreshIntervalMs: ADMIN_REFRESH_INTERVAL_MS },
  );
  async function remove(user) {
    if (busy) return;
    if (!window.confirm(`¿Eliminar la cuenta de ${user.name}?`)) return;
    setBusy(true);
    try {
      await adminMutation(`/api/admin/users/${user._id}`, { method: 'DELETE' });
      refresh();
    } catch (cause) {
      window.alert(cause.message);
    } finally {
      setBusy(false);
    }
  }
  async function changeRole(user) {
    if (busy) return;
    const nextRole = user.role === 'admin' ? 'user' : 'admin';
    const action =
      nextRole === 'admin'
        ? 'Dar acceso de administrador a'
        : 'Retirar el acceso de administrador a';
    if (
      !window.confirm(
        `${action} ${user.name}? Sus sesiones se cerrarán y deberá iniciar sesión de nuevo. Los administradores deben usar MFA.`,
      )
    )
      return;
    setBusy(true);
    setNotice('');
    try {
      const result = await adminMutation(`/api/admin/users/${user._id}/role`, {
        method: 'PATCH',
        body: JSON.stringify({ role: nextRole }),
      });
      setNotice(result.message);
      refresh();
    } catch (cause) {
      setNotice(cause.message);
      refresh();
    } finally {
      setBusy(false);
    }
  }
  if (error) return <AdminNotice error={error} />;
  if (!data)
    return (
      <section className="admin-container container">
        <p role="status">Cargando usuarios…</p>
      </section>
    );
  return (
    <section className="admin-container container admin-users-page">
      <header className="admin-header">
        <hgroup>
          <h1>
            <i aria-hidden="true" className="ri-user-settings-line" /> Gestión de Usuarios
          </h1>
          <p className="text-muted">
            La presencia se actualiza automáticamente cada {ADMIN_REFRESH_INTERVAL_MS / 1000}{' '}
            segundos.
          </p>
        </hgroup>
        <a href="/admin/dashboard" className="btn btn-outline btn-sm">
          ← Volver al Dashboard
        </a>
      </header>
      <p>
        Solo el propietario puede asignar o retirar administradores. La cuenta del propietario está
        protegida.
      </p>
      {notice && <p role="status">{notice}</p>}
      <form
        className="catalog-filters"
        role="search"
        onSubmit={(event) => {
          event.preventDefault();
          setPage(1);
          setFilter({ search, role });
        }}
      >
        <fieldset className="filter-group search-group">
          <label className="sr-only" htmlFor="admin-users-search">
            Buscar usuarios
          </label>
          <input
            id="admin-users-search"
            type="search"
            placeholder="Buscar por nombre o email…"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </fieldset>
        <fieldset className="filter-group">
          <label htmlFor="admin-users-role">Rol:</label>
          <select
            id="admin-users-role"
            value={role}
            onChange={(event) => setRole(event.target.value)}
          >
            <option value="">Todos los roles</option>
            <option value="user">Usuarios</option>
            <option value="admin">Administradores</option>
            <option value="owner">Propietario</option>
          </select>
        </fieldset>
        <button className="btn btn-primary btn-sm">Filtrar</button>
        {(filter.search || filter.role) && (
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => {
              setSearch('');
              setRole('');
              setFilter({ search: '', role: '' });
              setPage(1);
            }}
          >
            Limpiar filtros
          </button>
        )}
      </form>
      <div className="admin-table-wrapper">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Usuario</th>
              <th>Email</th>
              <th>Rol</th>
              <th>Registro</th>
              <th>Presencia</th>
              <th>Última actividad</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {data.users.map((user) => (
              <tr key={user._id}>
                <td>
                  <strong>{user.name}</strong>
                </td>
                <td>
                  <a href={`mailto:${user.email}`}>{user.email}</a>
                </td>
                <td>
                  <span className={`badge badge-${user.role !== 'user' ? 'primary' : 'secondary'}`}>
                    {{ owner: 'Propietario', admin: 'Admin', user: 'Usuario' }[user.role] ||
                      user.role}
                  </span>
                </td>
                <td>{date(user.createdAt)}</td>
                <td>
                  <span className={`badge badge-${user.isOnline ? 'success' : 'secondary'}`}>
                    {user.isOnline ? 'En línea' : 'Desconectado'}
                  </span>
                </td>
                <td>
                  {user.lastSeenAt
                    ? date(user.lastSeenAt, { dateStyle: 'short', timeStyle: 'short' })
                    : 'Sin actividad registrada'}
                </td>
                <td>
                  {user.role === 'owner' ? (
                    'Protegido'
                  ) : (
                    <>
                      {data.canManageRoles && (
                        <button
                          type="button"
                          className="btn btn-sm btn-outline"
                          disabled={busy}
                          onClick={() => changeRole(user)}
                        >
                          {user.role === 'admin' ? 'Quitar administrador' : 'Hacer administrador'}
                        </button>
                      )}
                      {user.role === 'user' ? (
                        <button
                          type="button"
                          className="btn btn-sm btn-delete"
                          onClick={() => remove(user)}
                          disabled={busy}
                        >
                          Eliminar
                        </button>
                      ) : (
                        'Cuenta administrativa protegida'
                      )}
                    </>
                  )}
                </td>
              </tr>
            ))}
            {!data.users.length && (
              <tr>
                <td colSpan="7">No se encontraron usuarios con esos filtros.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <AdminPagination pagination={data.pagination} onPage={setPage} />
    </section>
  );
}
