import { createContext, useContext } from 'react';
import { categories } from '../config/storeCatalog.js';

export const defaultCategories = categories.map((name, order) => ({
  id: `category-${order + 1}`,
  name,
  image: '',
  order,
  aliases: [],
}));
export const StoreCategoriesContext = createContext({
  categories: defaultCategories,
  refresh: () => {},
});
export default function useStoreCategories() {
  return useContext(StoreCategoriesContext);
}
