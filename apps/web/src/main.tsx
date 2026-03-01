// OpenTelemetry browser tracing - must be first import
import './tracing';

import ReactDOM from 'react-dom/client';
import App from './App';

ReactDOM.createRoot(document.getElementById('root')!).render(<App />);
