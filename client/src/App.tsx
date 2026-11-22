// client/src/App.tsx
import { useEffect } from 'react';
import { hydrate, useApp } from './store';
import { Header } from './components/Header';
import { SetupView } from './components/SetupView';
import { LiveView } from './components/LiveView';
import { ReportView } from './components/ReportView';
import { AudienceView } from './components/AudienceView';
import { TemplatesView } from './components/TemplatesView';
import { CreditsView, FaqView } from './components/InfoViews';

const joinCode = new URLSearchParams(window.location.search).get('join');

function PresenterApp() {
  const hydrated = useApp((s) => s.hydrated);
  const view = useApp((s) => s.view);

  useEffect(() => {
    hydrate();
  }, []);

  if (!hydrated) return <div className="splash">⏳</div>;
  return (
    <div className={`app view-${view}`}>
      <Header />
      {view === 'setup' && <SetupView />}
      {view === 'live' && <LiveView />}
      {view === 'report' && <ReportView />}
      {view === 'templates' && <TemplatesView />}
      {view === 'faq' && <FaqView />}
      {view === 'credits' && <CreditsView />}
    </div>
  );
}

export function App() {
  return joinCode !== null ? <AudienceView initialCode={joinCode} /> : <PresenterApp />;
}
