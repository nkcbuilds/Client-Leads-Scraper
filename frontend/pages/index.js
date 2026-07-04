import { useState, useEffect } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import Layout, { cardStyle, inputStyle, buttonStyle, thStyle, tdStyle } from '../components/Layout';
import { api } from '../lib/api';

export default function Home() {
  const [url, setUrl] = useState('');
  const [label, setLabel] = useState('');
  const [jobs, setJobs] = useState([]);
  const [health, setHealth] = useState(null);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [mode, setMode] = useState('live');
  const [manualContent, setManualContent] = useState('');
  const [manualType, setManualType] = useState('text');

  async function loadData() {
    try {
      const [jobsData, healthData] = await Promise.all([api.getJobs(), api.health()]);
      setJobs(jobsData);
      setHealth(healthData);
      setError('');
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 5000);
    return () => clearInterval(interval);
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      const payload = { url, label };
      if (mode === 'manual' && manualContent.trim()) {
        if (manualType === 'html') payload.manual_html = manualContent;
        else payload.manual_text = manualContent;
      }
      await api.createJob(payload);
      setUrl('');
      setLabel('');
      setManualContent('');
      await loadData();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  const statusColor = {
    pending: '#f59e0b',
    running: '#3b82f6',
    done: '#10b981',
    done_with_warnings: '#f59e0b',
    blocked: '#ef4444',
    failed: '#ef4444',
  };

  return (
    <Layout title="Dashboard">
      <Head>
        <title>LegalReach — Lead Scraper</title>
      </Head>

      {health && (
        <p style={{ fontSize: '0.85rem', color: '#10b981', marginTop: '-1rem', marginBottom: '1.5rem' }}>
          Backend connected — queue: {health.queue.pending} pending
        </p>
      )}

      <div style={cardStyle}>
        <h2 style={sectionTitle}>Add Source URL</h2>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxWidth: 560 }}>
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <label style={{ fontSize: '0.9rem' }}>
              <input type="radio" checked={mode === 'live'} onChange={() => setMode('live')} /> Live Crawl
            </label>
            <label style={{ fontSize: '0.9rem' }}>
              <input type="radio" checked={mode === 'manual'} onChange={() => setMode('manual')} /> Manual Import
            </label>
          </div>
          <input
            type="url"
            placeholder="https://example.com/legal-directory"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            required
            style={inputStyle}
          />
          <input
            type="text"
            placeholder="Label (optional)"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            style={inputStyle}
          />
          {mode === 'manual' && (
            <>
              <select value={manualType} onChange={(e) => setManualType(e.target.value)} style={inputStyle}>
                <option value="text">Manual text</option>
                <option value="html">Manual HTML</option>
              </select>
              <textarea
                placeholder={manualType === 'html' ? 'Paste saved page HTML here' : 'Paste copied page text here'}
                value={manualContent}
                onChange={(e) => setManualContent(e.target.value)}
                style={{ ...inputStyle, minHeight: 180, fontFamily: 'monospace' }}
                required={mode === 'manual'}
              />
            </>
          )}
          <button type="submit" disabled={submitting} style={{ ...buttonStyle, width: 'fit-content' }}>
            {submitting ? 'Submitting...' : 'Start Scrape Job'}
          </button>
        </form>
        {error && <p style={{ color: '#ef4444', marginTop: '0.75rem' }}>{error}</p>}
      </div>

      <div style={cardStyle}>
        <h2 style={sectionTitle}>Jobs</h2>
        {jobs.length === 0 ? (
          <p style={{ color: '#64748b' }}>No jobs yet. Submit a URL above to get started.</p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #e2e8f0', textAlign: 'left' }}>
                <th style={thStyle}>ID</th>
                <th style={thStyle}>Label</th>
                <th style={thStyle}>URL</th>
                <th style={thStyle}>Status</th>
                <th style={thStyle}>Pages</th>
                <th style={thStyle}>Records</th>
                <th style={thStyle}>Created</th>
                <th style={thStyle}></th>
              </tr>
            </thead>
            <tbody>
              {jobs.map((job) => (
                <tr key={job.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                  <td style={tdStyle}>{job.id}</td>
                  <td style={tdStyle}>{job.label || '—'}</td>
                  <td style={{ ...tdStyle, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    <a href={job.url} target="_blank" rel="noopener noreferrer">{job.url}</a>
                  </td>
                  <td style={tdStyle}>
                    <span style={{
                      color: statusColor[job.status] || '#64748b',
                      fontWeight: 600,
                      textTransform: 'uppercase',
                      fontSize: '0.8rem',
                    }}>
                      {job.status}
                    </span>
                    {job.error_message && (
                      <div style={{ fontSize: '0.75rem', color: '#f59e0b', marginTop: 2 }} title={job.error_message}>
                        ⚠ {job.error_message.slice(0, 40)}{job.error_message.length > 40 ? '…' : ''}
                      </div>
                    )}
                  </td>
                  <td style={tdStyle}>{job.pages_scraped}</td>
                  <td style={tdStyle}>{job.records_found}</td>
                  <td style={tdStyle}>{new Date(job.created_at + 'Z').toLocaleString()}</td>
                  <td style={tdStyle}>
                    <Link href={`/results/${job.id}`}>Results</Link>
                    {' · '}
                    <Link href={`/jobs/${job.id}`}>Logs</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </Layout>
  );
}

const sectionTitle = { fontSize: '1.1rem', fontWeight: 600, marginBottom: '1rem' };
