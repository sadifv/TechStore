import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';
import react from '@vitejs/plugin-react';

test('specifications render semantic pairs, escape text and omit the legacy empty section', async () => {
  const server = await createServer({
    configFile: false,
    plugins: [react()],
    server: { middlewareMode: true, watch: null },
    appType: 'custom',
  });
  try {
    const { default: ProductSpecifications } = await server.ssrLoadModule(
      '/src/components/catalog/ProductSpecifications.jsx',
    );
    assert.equal(renderToStaticMarkup(createElement(ProductSpecifications)), '');
    assert.equal(
      renderToStaticMarkup(createElement(ProductSpecifications, { specifications: [] })),
      '',
    );
    const html = renderToStaticMarkup(
      createElement(ProductSpecifications, {
        specifications: [
          { name: 'RAM', value: '16 GB' },
          { name: 'Texto', value: '<script>unsafe</script>' },
        ],
      }),
    );
    assert.match(html, /<dl[^>]*>.*<dt>RAM<\/dt><dd>16 GB<\/dd>/);
    assert.match(html, /&lt;script&gt;unsafe&lt;\/script&gt;/);
    assert.doesNotMatch(html, /<script>/);
    const { default: SpecificationFields } = await server.ssrLoadModule(
      '/src/components/admin/SpecificationFields.jsx',
    );
    const fields = renderToStaticMarkup(
      createElement(SpecificationFields, {
        specifications: [{ name: 'RAM', value: '16 GB' }],
        disabled: false,
      }),
    );
    assert.match(fields, /name="specifications"/);
    assert.match(
      fields,
      /value="\[\{&quot;name&quot;:&quot;RAM&quot;,&quot;value&quot;:&quot;16 GB&quot;\}\]"/,
    );
    assert.match(fields, /maxLength="40"/);
    assert.match(fields, /maxLength="200"/);
    assert.match(fields, /Eliminar característica 1/);
  } finally {
    await server.close();
  }
});
