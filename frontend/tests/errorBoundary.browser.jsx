import { createRoot } from 'react-dom/client';
import AppErrorBoundary from '../src/components/AppErrorBoundary.jsx';
export function ThrowingChild() { throw new Error('Controlled browser test'); }
createRoot(document.getElementById('root')).render(<AppErrorBoundary><ThrowingChild /></AppErrorBoundary>);
