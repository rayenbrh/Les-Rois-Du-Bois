import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

window.addEventListener('unhandledrejection', (event) => {
  // Keep the console useful without crashing the UI
  console.error('❌ [UNHANDLED PROMISE REJECTION]', event.reason);
});

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
