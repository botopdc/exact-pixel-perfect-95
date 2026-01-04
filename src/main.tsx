import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';

// Initialize theme from localStorage before render to prevent flash
const savedTheme = localStorage.getItem('open-datacenter-theme') || 'dark';
document.documentElement.classList.add(savedTheme);

createRoot(document.getElementById('root')!).render(<App />);
