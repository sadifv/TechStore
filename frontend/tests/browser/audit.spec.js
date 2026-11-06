import { test, expect, user, product } from './fixtures.js';

test('owner consulta cambios, pagina, filtra y reintenta el historial', async ({ page, mock }) => {
  mock.role = 'owner';
  let fail = false;
  mock.handlers.set('GET /api/admin/audit', async (route) => {
    if (fail) {
      fail = false;
      return route.fulfill({
        status: 503,
        json: { success: false, error: 'Historial temporalmente no disponible.' },
      });
    }
    const query = new URL(route.request().url()).searchParams;
    const filtered = query.get('action') === 'appearance.updated';
    await route.fulfill({
      json: {
        success: true,
        data: {
          events: filtered
            ? []
            : [
                {
                  _id: 'cccccccccccccccccccccccc',
                  createdAt: '2026-11-05T12:00:00.000Z',
                  actorId: user.id,
                  action: 'product.updated',
                  resourceType: 'product',
                  resourceId: product._id,
                  changes: [{ field: 'price', before: 300, after: 329 }],
                },
              ],
          pagination: {
            currentPage: Number(query.get('page')),
            totalPages: filtered ? 1 : 2,
            totalCount: filtered ? 0 : 2,
          },
          startedAt: '2026-11-01T12:00:00.000Z',
        },
      },
    });
  });
  await page.goto('/admin/dashboard');
  await page.getByRole('link', { name: 'Historial administrativo', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Producto actualizado', exact: true }),
  ).toBeVisible();
  await expect(page.getByText(`Responsable (ID): ${user.id}`)).toBeVisible();
  await page.getByText('Ver cambios registrados', { exact: true }).click();
  await expect(page.locator('dd')).toHaveText('Antes: 300 · Después: 329');
  await page.getByRole('button', { name: 'Siguiente »', exact: true }).click();
  await expect
    .poll(() => mock.requests.filter((r) => r.key === 'GET /api/admin/audit').at(-1)?.url)
    .toContain('page=2');
  await page.getByLabel('Acción', { exact: true }).selectOption('appearance.updated');
  await page.getByLabel('Desde', { exact: true }).fill('2026-11-01');
  await page.getByLabel('Hasta', { exact: true }).fill('2026-11-05');
  await page.getByRole('button', { name: 'Filtrar historial', exact: true }).click();
  await expect(page.getByText('No hay acciones para los filtros seleccionados.')).toBeVisible();
  const latest = new URL(mock.requests.filter((r) => r.key === 'GET /api/admin/audit').at(-1).url);
  expect(Object.fromEntries(latest.searchParams)).toEqual({
    action: 'appearance.updated',
    from: '2026-11-01',
    to: '2026-11-05',
    page: '1',
  });
  fail = true;
  await page.getByRole('button', { name: 'Actualizar historial' }).click();
  await expect(page.getByRole('alert')).toContainText('Historial temporalmente no disponible.');
  await page.getByRole('button', { name: 'Reintentar historial' }).click();
  await expect(page.getByText('No hay acciones para los filtros seleccionados.')).toBeVisible();
});

for (const role of ['guest', 'user', 'admin']) {
  test(`interfaz reserva historial al owner: ${role}`, async ({ page, mock }) => {
    mock.role = role;
    await page.goto('/admin/audit');
    await expect(
      page.getByRole('heading', { name: 'Acceso reservado al propietario' }),
    ).toBeVisible();
    expect(mock.requests.some((r) => r.key === 'GET /api/admin/audit')).toBe(false);
  });
}
