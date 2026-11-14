const test = require('node:test');
const assert = require('node:assert/strict');
const { defaultCategories, normalizeCategoryList } = require('../services/storeCategories');

const payload = () => ({
  revision: 0,
  categories: defaultCategories.map(({ id, name, image, order }) => ({ id, name, image, order })),
});
test('categories retain Muebles and validate bounded text, images, identity and ordering', () => {
  assert(defaultCategories.some((entry) => entry.name === 'Muebles'));
  const value = payload();
  value.categories[0].name = 'Portátiles';
  value.categories[0].image = 'https://example.invalid/laptop.webp';
  const normalized = normalizeCategoryList(value, defaultCategories);
  assert.deepEqual(normalized[0].aliases, ['Laptops']);
  assert.equal(normalized[0].id, defaultCategories[0].id);
  for (const mutate of [
    (body) => {
      body.categories[0].name = '<script>';
    },
    (body) => {
      body.categories[0].name = 'all';
    },
    (body) => {
      body.categories[0].name = ' ALL ';
    },
    (body) => {
      body.categories[0].name = 'a'.repeat(81);
    },
    (body) => {
      body.categories[0].name = 'Audio';
    },
    (body) => {
      body.categories[0].id = '$where';
    },
    (body) => {
      body.categories[0].order = 2;
    },
    (body) => {
      body.categories[0].image = 'javascript:alert(1)';
    },
    (body) => {
      body.categories[0].image = '//evil.invalid/image.jpg';
    },
    (body) => {
      body.categories[0].image = '/images/../private.jpg';
    },
    (body) => {
      body.categories[0].image = 'https://user:password@example.invalid/file.jpg';
    },
    (body) => {
      body.categories[0].aliases = ['Override'];
    },
    (body) => {
      body.revision = '0';
    },
    (body) => {
      body.categories = [];
    },
    (body) => {
      body.theme = 'normal';
    },
  ]) {
    const body = payload();
    mutate(body);
    assert.throws(() => normalizeCategoryList(body, defaultCategories), { statusCode: 400 });
  }
});

test('category aliases cannot be taken over by another category', () => {
  const first = payload();
  first.categories[0].name = 'Portátiles';
  const previous = normalizeCategoryList(first, defaultCategories);
  const body = {
    revision: 1,
    categories: previous.map(({ id, name, image, order }) => ({ id, name, image, order })),
  };
  body.categories[1].name = 'Laptops';
  assert.throws(() => normalizeCategoryList(body, previous), { statusCode: 400 });
});
