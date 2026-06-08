import React from 'react';
import { createRoot } from 'react-dom/client';
import { AppRouter } from './router';
import './styles/global.css';

const container = document.getElementById('root');
if (!container) throw new Error('#root element not found');

createRoot(container).render(
  <React.StrictMode>
    <AppRouter />
  </React.StrictMode>
);
