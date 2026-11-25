// client/src/App.tsx
import { useEffect, useState } from 'react';
import { PixelView } from './components/PixelView';
import { hydrate, useApp } from './store';
import { Shell } from './components/Shell';
import { SetupView } from './components/SetupView';
import { LiveView } from './components/LiveView';
import { ReportView } from './components/ReportView';
import { AudienceView } from './components/AudienceView';
import { TemplatesView } from './components/TemplatesView';
import { CreditsView } from './components/InfoViews';
import { HelpCenter } from './components/HelpCenter';
import { LibraryView } from './components/LibraryView';
import { SharedEntry } from './components/SharedEntry';
import { initCloudSync } from './lib/cloud';

const params = new URLSearchParams(window.location.search);
const joinCode = params.get('join');
const shareId = params.get('s');

function PresenterApp() {
  const hydrated = useApp((s) => s.hydrated);
  const view = useApp((s) => s.view);

  useEffect(() => {
    void hydrate().then(initCloudSync);
  }, []);

  if (!hydrated) return <div className="splash">⏳</div>;
  return (
    <Shell>
      {view === 'library' && <LibraryView />}
      {view === 'setup' && <SetupView />}
      {view === 'live' && <LiveView />}
      {view === 'report' && <ReportView />}
      {view === 'templates' && <TemplatesView />}
      {view === 'faq' && <HelpCenter />}
      {view === 'credits' && <CreditsView />}
      {view === 'pixels' && <PixelView />}
    </Shell>
  );
}

export function App() {
  const [shared, setShared] = useState(shareId && /^[A-Za-z0-9]{6,20}$/.test(shareId) ? shareId : null);
  if (joinCode !== null) return <AudienceView initialCode={joinCode} />;
  if (shared) return <SharedEntry shareId={shared} onOpenApp={() => setShared(null)} />;
  return <PresenterApp />;
}
