import { useContext } from 'react';
import { StoreContentContext } from '../components/content/StoreContentContext.js';

export default function useStoreContent() {
  return useContext(StoreContentContext);
}
