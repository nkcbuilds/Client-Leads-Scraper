import Link from 'next/link';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';

const NAV = [
  { href: '/', label: 'Dashboard' },
  { href: '/settings', label: 'Settings' },
];

export default function Layout({ children, title }) {
  const router = useRouter();
  const [desktopMeta, setDesktopMeta] = useState(null);
  const [updateState, setUpdateState] = useState(null);
  const [runtimeState, setRuntimeState] = useState(null);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.desktopApp) return undefined;

    let mounted = true;
    window.desktopApp.getAppMeta().then((meta) => {
      if (mounted) setDesktopMeta(meta);
    }).catch(() => {});
    window.desktopApp.getUpdateState().then((state) => {
      if (mounted) setUpdateState(state);
    }).catch(() => {});
    window.desktopApp.getRuntimeState().then((state) => {
      if (mounted) setRuntimeState(state);
    }).catch(() => {});

    const unsubscribeUpdate = window.desktopApp.onUpdateState((state) => {
      if (mounted) setUpdateState(state);
    });
    const unsubscribeRuntime = window.desktopApp.onRuntimeState((state) => {
      if (mounted) setRuntimeState(state);
    });

    return () => {
      mounted = false;
      if (unsubscribeUpdate) unsubscribeUpdate();
      if (unsubscribeRuntime) unsubscribeRuntime();
    };
  }, []);

  const showUpdateBanner = desktopMeta?.isDesktop && updateState && updateState.status !== 'idle';
  const desktopHealthy = runtimeState?.phase === 'ready';

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc' }}>
      <nav style={{
        background: '#0f172a',
        color: '#fff',
        padding: '0.95rem 2rem',
        display: 'flex',
        alignItems: 'center',
        gap: '2rem',
        borderBottom: '1px solid rgba(148,163,184,0.14)',
      }}>
        <Link href="/" style={{ color: '#fff', fontWeight: 700, fontSize: '1.1rem', textDecoration: 'none', letterSpacing: '0.02em' }}>
          LegalReach
        </Link>
        <div style={{ display: 'flex', gap: '1.25rem' }}>
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              style={{
                color: router.pathname === item.href ? '#93c5fd' : '#cbd5e1',
                textDecoration: 'none',
                fontSize: '0.92rem',
                fontWeight: router.pathname === item.href ? 600 : 400,
              }}
            >
              {item.label}
            </Link>
          ))}
        </div>
        {desktopMeta?.isDesktop && (
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <span style={{
              padding: '0.28rem 0.6rem',
              borderRadius: 999,
              fontSize: '0.78rem',
              fontWeight: 600,
              background: desktopHealthy ? 'rgba(16,185,129,0.16)' : 'rgba(245,158,11,0.16)',
              color: desktopHealthy ? '#6ee7b7' : '#fcd34d',
              border: `1px solid ${desktopHealthy ? 'rgba(16,185,129,0.28)' : 'rgba(245,158,11,0.28)'}`,
            }}
            >
              {runtimeState?.phase === 'ready' ? 'Desktop Healthy' : 'Desktop Starting'}
            </span>
            <div style={{ color: '#94a3b8', fontSize: '0.8rem' }}>
              Desktop v{desktopMeta.version}
            </div>
          </div>
        )}
      </nav>
      <main style={{ maxWidth: 1160, margin: '0 auto', padding: '2rem' }}>
        {showUpdateBanner && (
          <div style={{
            ...cardStyle,
            marginBottom: '1rem',
            background: '#eff6ff',
            border: '1px solid #bfdbfe',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '1rem',
          }}>
            <div>
              <div style={{ fontWeight: 600, color: '#1d4ed8', marginBottom: '0.25rem' }}>Desktop Update</div>
              <div style={{ color: '#334155', fontSize: '0.9rem' }}>{updateState.message}</div>
            </div>
            {updateState.downloaded && (
              <button
                type="button"
                onClick={() => window.desktopApp.quitAndInstallUpdate()}
                style={{ ...buttonStyle, whiteSpace: 'nowrap' }}
              >
                Restart to Update
              </button>
            )}
          </div>
        )}
        {desktopMeta?.isDesktop && runtimeState && (
          <div style={{
            ...cardStyle,
            marginBottom: '1rem',
            background: 'linear-gradient(135deg, #0f172a 0%, #1e3a8a 100%)',
            color: '#e2e8f0',
            border: '1px solid rgba(96,165,250,0.24)',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'flex-start', flexWrap: 'wrap' }}>
              <div>
                <div style={{ fontSize: '0.8rem', letterSpacing: '0.08em', textTransform: 'uppercase', color: '#93c5fd', marginBottom: '0.4rem' }}>
                  Desktop Runtime
                </div>
                <div style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '0.35rem' }}>
                  {runtimeState.phase === 'ready' ? 'Ready for scraping' : 'Warming up desktop services'}
                </div>
                <div style={{ color: '#cbd5e1', maxWidth: 760 }}>
                  {runtimeState.statusLine}
                </div>
              </div>
              <Link href="/settings" style={{ color: '#e2e8f0', textDecoration: 'none', fontWeight: 600 }}>
                Open diagnostics
              </Link>
            </div>
          </div>
        )}
        {title && <h1 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '1.5rem', color: '#0f172a' }}>{title}</h1>}
        {children}
      </main>
    </div>
  );
}

export const cardStyle = {
  background: '#fff',
  borderRadius: 16,
  padding: '1.5rem',
  boxShadow: '0 14px 38px rgba(15, 23, 42, 0.06)',
  marginBottom: '1.5rem',
};

export const inputStyle = {
  padding: '0.7rem 0.85rem',
  border: '1px solid #cbd5e1',
  borderRadius: 10,
  fontSize: '0.95rem',
  width: '100%',
};

export const buttonStyle = {
  padding: '0.7rem 1rem',
  background: '#2563eb',
  color: '#fff',
  border: 'none',
  borderRadius: 10,
  fontSize: '0.95rem',
  fontWeight: 600,
  cursor: 'pointer',
};

export const secondaryButtonStyle = {
  ...buttonStyle,
  background: '#fff',
  color: '#334155',
  border: '1px solid #cbd5e1',
};

export const thStyle = { padding: '0.5rem 0.75rem' };
export const tdStyle = { padding: '0.5rem 0.75rem' };
