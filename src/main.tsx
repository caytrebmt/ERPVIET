import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import i18n, { getStoredLanguage } from "./i18n";
import './index.css';

if (typeof document !== 'undefined') {
  document.documentElement.lang = getStoredLanguage();
  document.documentElement.classList.remove('i18n-pending');
}

// i18n is initialised synchronously from bundled JSON before this render,
// so the first paint already has real copy (no raw translation keys).
void i18n;

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
