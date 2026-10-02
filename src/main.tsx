import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles.css';
class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { error: string }> {
  state = { error: '' };
  static getDerivedStateFromError(error: Error) { return { error: error.message }; }
  render() { return this.state.error ? <div className="fatal-error"><h1>Le plan n’a pas pu être affiché.</h1><p>{this.state.error}</p><p>Vos plans enregistrés restent disponibles sur cet ordinateur.</p><button className="button primary" onClick={() => window.location.reload()}>Relancer PlanoPilot</button></div> : this.props.children; }
}
createRoot(document.getElementById('root')!).render(<ErrorBoundary><App/></ErrorBoundary>);
