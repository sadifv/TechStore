import { createContext } from 'react';
import defaults from '../../config/storeContentDefaults.json';

export const StoreContentContext = createContext({ content: defaults, setContent: () => {} });
