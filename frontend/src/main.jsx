import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.jsx';
import AppErrorBoundary from './components/feedback/AppErrorBoundary.jsx';

createRoot(document.getElementById('root')).render(
  <AppErrorBoundary>
    <App />
  </AppErrorBoundary>,
);
