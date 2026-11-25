// client/src/App.tsx — routes; heavy views are code-split so the first paint stays light on phones
import { lazy, Suspense, useEffect, useState } from 'react';
import { hydrate, useApp } from './store';
import { Shell } from './components/Shell';
import { SetupView } from './components/SetupView';
import { initCloudSync } from './lib/cloud';
import { initAccount } from './lib/account';

const LiveView = lazy(() => import('./components/LiveView').then((m) => ({ default: m.LiveView })));
const ReportView = lazy(() => import('./components/ReportView').then((m) => ({ default: m.ReportView })));
const TemplatesView = lazy(() => import('./components/TemplatesView').then((m) => ({ default: m.TemplatesView })));
const HelpCenter = lazy(() => import('./components/HelpCenter').then((m) => ({ default: m.HelpCenter })));
const CreditsView = lazy(() => import('./components/InfoViews').then((m) => ({ default: m.CreditsView })));
const LibraryView = lazy(() => import('./components/LibraryView').then((m) => ({ default: m.LibraryView })));
const PixelView = lazy(() => import('./components/PixelView').then((m) => ({ default: m.PixelView })));
const AudienceView = lazy(() => import('./components/AudienceView').then((m) => ({ default: m.AudienceView })));
const SharedEntry = lazy(() => import('./components/SharedEntry').then((m) => ({ default: m.SharedEntry })));

const params = new URLSearchParams(window.location.search);
const joinCode = params.get('join');
const shareId = params.get('s');

const Loading = () => (
  <div className="splash" role="status" aria-label="Yükleniyor">
    ⏳
  </div>
);

function PresenterApp() {
  const hydrated = useApp((s) => s.hydrated);
  const view = useApp((s) => s.view);

  useEffect(() => {
    void hydrate().then(() => {
      initCloudSync();
      void initAccount();
    });
  }, []);

  if (!hydrated) return <Loading />;
  return (
    <Shell>
      <Suspense fallback={<Loading />}>
        {view === 'library' && <LibraryView />}
        {view === 'setup' && <SetupView />}
        {view === 'live' && <LiveView />}
        {view === 'report' && <ReportView />}
        {view === 'templates' && <TemplatesView />}
        {view === 'faq' && <HelpCenter />}
        {view === 'credits' && <CreditsView />}
        {view === 'pixels' && <PixelView />}
      </Suspense>
    </Shell>
  );
}

export function App() {
  const [shared, setShared] = useState(shareId && /^[A-Za-z0-9]{6,20}$/.test(shareId) ? shareId : null);
  if (joinCode !== null)
    return (
      <Suspense fallback={<Loading />}>
        <AudienceView initialCode={joinCode} />
      </Suspense>
    );
  if (shared)
    return (
      <Suspense fallback={<Loading />}>
        <SharedEntry shareId={shared} onOpenApp={() => setShared(null)} />
      </Suspense>
    );
  return <PresenterApp />;
}
