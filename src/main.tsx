import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import { missingEnv } from './config/env';
import { ConfigError } from './components/layout/ConfigError';

const root = createRoot(document.getElementById('root')!);

// Firebase is only loaded when the configuration is complete, so a missing env var
// shows a clear message instead of a blank page.
if (missingEnv.length) {
  root.render(<ConfigError missing={missingEnv} />);
} else {
  import('./App').then(({ App }) =>
    root.render(
      <StrictMode>
        <App />
      </StrictMode>,
    ),
  );
}
