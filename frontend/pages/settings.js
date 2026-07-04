import { useEffect, useState } from 'react';
import Head from 'next/head';
import Layout, { cardStyle, inputStyle, buttonStyle } from '../components/Layout';
import { api } from '../lib/api';

const SERVICE_LABELS = {
  filesystem: 'Workspace',
  playwright: 'Playwright',
  backend: 'Backend API',
  frontend: 'Desktop UI',
};

export default function Settings() {
  const [settings, setSettings] = useState({
    crawl_delay_ms: '2000',
    crawl_concurrency: '2',
    crawl_timeout_ms: '30000',
    gemini_api_key: '',
    browser_storage_state_path: '',
    output_path: './output',
  });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [desktopMeta, setDesktopMeta] = useState(null);
  const [runtimeState, setRuntimeState] = useState(null);

  useEffect(() => {
    api.getSettings().then(setSettings).catch((e) => setError(e.message));
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.desktopApp) return undefined;

    let mounted = true;
    window.desktopApp.getAppMeta().then((meta) => {
      if (mounted) setDesktopMeta(meta);
    }).catch(() => {});
    window.desktopApp.getRuntimeState().then((state) => {
      if (mounted) setRuntimeState(state);
    }).catch(() => {});

    const unsubscribe = window.desktopApp.onRuntimeState((state) => {
      if (mounted) setRuntimeState(state);
    });

    return () => {
      mounted = false;
      if (unsubscribe) unsubscribe();
    };
  }, []);

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    setMessage('');
    setError('');
    try {
      const updates = { ...settings };
      if (updates.gemini_api_key === '***configured***') {
        delete updates.gemini_api_key;
      }
      const result = await api.updateSettings(updates);
      setSettings(result);
      setMessage('Settings saved successfully.');
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  function updateField(key, value) {
    setSettings((s) => ({ ...s, [key]: value }));
  }

  return (
    <Layout title="Settings">
      <Head>
        <title>Settings - LegalReach</title>
      </Head>

      <div style={cardStyle}>
        <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', maxWidth: 520 }}>
          <label>
            <span style={labelStyle}>Crawl delay (ms)</span>
            <input
              type="number"
              value={settings.crawl_delay_ms}
              onChange={(e) => updateField('crawl_delay_ms', e.target.value)}
              style={inputStyle}
              min="500"
            />
          </label>

          <label>
            <span style={labelStyle}>Concurrency</span>
            <input
              type="number"
              value={settings.crawl_concurrency}
              onChange={(e) => updateField('crawl_concurrency', e.target.value)}
              style={inputStyle}
              min="1"
              max="5"
            />
          </label>

          <label>
            <span style={labelStyle}>Timeout (ms)</span>
            <input
              type="number"
              value={settings.crawl_timeout_ms}
              onChange={(e) => updateField('crawl_timeout_ms', e.target.value)}
              style={inputStyle}
              min="10000"
            />
          </label>

          <label>
            <span style={labelStyle}>Gemini API key</span>
            <input
              type="password"
              placeholder={settings.gemini_api_key === '***configured***' ? 'Key configured - enter new to replace' : 'Enter API key'}
              onChange={(e) => updateField('gemini_api_key', e.target.value)}
              style={inputStyle}
            />
          </label>

          <label>
            <span style={labelStyle}>Browser storage state path</span>
            <input
              type="text"
              value={settings.browser_storage_state_path || ''}
              onChange={(e) => updateField('browser_storage_state_path', e.target.value)}
              style={inputStyle}
              placeholder="Optional path to Playwright storageState JSON"
            />
          </label>

          <label>
            <span style={labelStyle}>Output path</span>
            <input
              type="text"
              value={settings.output_path}
              onChange={(e) => updateField('output_path', e.target.value)}
              style={inputStyle}
            />
          </label>

          <button type="submit" disabled={saving} style={{ ...buttonStyle, width: 'fit-content' }}>
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
        </form>

        {message && <p style={{ color: '#10b981', marginTop: '1rem' }}>{message}</p>}
        {error && <p style={{ color: '#ef4444', marginTop: '1rem' }}>{error}</p>}
      </div>

      {desktopMeta?.isDesktop && runtimeState && (
        <div style={{ ...cardStyle, padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '1.5rem', background: 'linear-gradient(135deg, #0f172a 0%, #1e40af 100%)', color: '#e2e8f0' }}>
            <div style={{ fontSize: '0.78rem', letterSpacing: '0.08em', textTransform: 'uppercase', color: '#93c5fd', marginBottom: '0.5rem' }}>
              Desktop Diagnostics
            </div>
            <div style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.4rem' }}>
              {runtimeState.phase === 'ready' ? 'Desktop runtime healthy' : 'Desktop runtime needs attention'}
            </div>
            <div style={{ color: '#cbd5e1', maxWidth: 820 }}>
              {runtimeState.statusLine}
            </div>
          </div>

          <div style={{ padding: '1.5rem' }}>
            <div style={serviceGridStyle}>
              {Object.entries(runtimeState.services || {}).map(([key, value]) => (
                <div key={key} style={serviceCardStyle}>
                  <div style={{ ...statusDotStyle, background: serviceColor(value) }} />
                  <div>
                    <div style={{ fontWeight: 600, color: '#0f172a', marginBottom: '0.2rem' }}>
                      {SERVICE_LABELS[key] || key}
                    </div>
                    <div style={{ color: '#475569', textTransform: 'capitalize' }}>{value}</div>
                  </div>
                </div>
              ))}
            </div>

            <div style={detailsGridStyle}>
              <div>
                <div style={subheadingStyle}>Runtime Paths</div>
                <dl style={detailListStyle}>
                  <div>
                    <dt style={dtStyle}>Database</dt>
                    <dd style={ddStyle}>{desktopMeta.dbPath}</dd>
                  </div>
                  <div>
                    <dt style={dtStyle}>Browser Sessions</dt>
                    <dd style={ddStyle}>{desktopMeta.browserStorageDir}</dd>
                  </div>
                  <div>
                    <dt style={dtStyle}>Playwright</dt>
                    <dd style={ddStyle}>{desktopMeta.playwrightBrowsersDir}</dd>
                  </div>
                  <div>
                    <dt style={dtStyle}>Frontend</dt>
                    <dd style={ddStyle}>{desktopMeta.frontendUrl}</dd>
                  </div>
                  <div>
                    <dt style={dtStyle}>Backend</dt>
                    <dd style={ddStyle}>{desktopMeta.backendUrl}</dd>
                  </div>
                </dl>
              </div>

              <div>
                <div style={subheadingStyle}>Mac Release Readiness</div>
                <ul style={checklistStyle}>
                  <li>App icon pipeline is wired for `icon.png`, `icon.ico`, and `icon.icns`.</li>
                  <li>Electron Builder notarization hook is configured for `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD`, and `APPLE_TEAM_ID`.</li>
                  <li>Final client rollout still requires those secrets to be added in GitHub Actions by the repo owner.</li>
                </ul>
              </div>
            </div>

            {runtimeState.lastError && (
              <div style={{ ...errorPanelStyle, marginTop: '1.25rem' }}>
                <div style={{ fontWeight: 700, marginBottom: '0.4rem' }}>Latest desktop error</div>
                <div>{runtimeState.lastError.message}</div>
              </div>
            )}

            <div style={{ marginTop: '1.5rem' }}>
              <div style={subheadingStyle}>Startup Timeline</div>
              <div style={timelineStyle}>
                {(runtimeState.checks || []).slice().reverse().map((entry, index) => (
                  <div key={`${entry.timestamp}-${index}`} style={timelineItemStyle}>
                    <div style={{ ...statusDotStyle, background: entry.level === 'error' ? '#ef4444' : '#2563eb', marginTop: '0.2rem' }} />
                    <div>
                      <div style={{ fontWeight: 600, color: '#0f172a' }}>{entry.message}</div>
                      <div style={{ color: '#64748b', fontSize: '0.85rem' }}>
                        {entry.step} · {new Date(entry.timestamp).toLocaleString()}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}

function serviceColor(state) {
  if (state === 'healthy') return '#10b981';
  if (state === 'error') return '#ef4444';
  if (state === 'starting') return '#f59e0b';
  return '#94a3b8';
}

const labelStyle = {
  display: 'block',
  fontSize: '0.85rem',
  fontWeight: 600,
  color: '#475569',
  marginBottom: '0.35rem',
};

const serviceGridStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
  gap: '0.9rem',
  marginBottom: '1.5rem',
};

const serviceCardStyle = {
  border: '1px solid #e2e8f0',
  borderRadius: 14,
  padding: '1rem',
  display: 'flex',
  alignItems: 'center',
  gap: '0.75rem',
  background: '#fff',
};

const statusDotStyle = {
  width: 12,
  height: 12,
  borderRadius: 999,
  flexShrink: 0,
};

const detailsGridStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
  gap: '1.5rem',
};

const subheadingStyle = {
  fontSize: '0.85rem',
  fontWeight: 700,
  color: '#334155',
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  marginBottom: '0.8rem',
};

const detailListStyle = {
  display: 'grid',
  gap: '0.8rem',
  margin: 0,
};

const dtStyle = {
  fontSize: '0.8rem',
  color: '#64748b',
  marginBottom: '0.2rem',
};

const ddStyle = {
  margin: 0,
  color: '#0f172a',
  fontSize: '0.92rem',
  wordBreak: 'break-word',
};

const checklistStyle = {
  margin: 0,
  paddingLeft: '1.1rem',
  color: '#0f172a',
  display: 'grid',
  gap: '0.7rem',
};

const errorPanelStyle = {
  borderRadius: 14,
  padding: '1rem 1.1rem',
  background: '#fef2f2',
  border: '1px solid #fecaca',
  color: '#991b1b',
};

const timelineStyle = {
  display: 'grid',
  gap: '0.9rem',
};

const timelineItemStyle = {
  display: 'flex',
  gap: '0.75rem',
  alignItems: 'flex-start',
  borderTop: '1px solid #e2e8f0',
  paddingTop: '0.9rem',
};
