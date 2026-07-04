import { useState, useEffect } from 'react';
import Head from 'next/head';
import Layout, { cardStyle, inputStyle, buttonStyle } from '../components/Layout';
import { api } from '../lib/api';

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

  useEffect(() => {
    api.getSettings().then(setSettings).catch((e) => setError(e.message));
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
        <title>Settings — LegalReach</title>
      </Head>

      <div style={cardStyle}>
        <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', maxWidth: 480 }}>
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
              placeholder={settings.gemini_api_key === '***configured***' ? 'Key configured — enter new to replace' : 'Enter API key'}
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
    </Layout>
  );
}

const labelStyle = {
  display: 'block',
  fontSize: '0.85rem',
  fontWeight: 600,
  color: '#475569',
  marginBottom: '0.35rem',
};
