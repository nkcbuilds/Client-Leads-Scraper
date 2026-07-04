import { useState, useEffect } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import Layout, { cardStyle, thStyle, tdStyle } from '../../components/Layout';
import { api } from '../../lib/api';

const STATUS_COLOR = {
  pending: '#f59e0b',
  running: '#3b82f6',
  done: '#10b981',
  done_with_warnings: '#f59e0b',
  blocked: '#ef4444',
  failed: '#ef4444',
  success: '#10b981',
  classified: '#6366f1',
};

export default function JobDetail() {
  const router = useRouter();
  const { id } = router.query;
  const [job, setJob] = useState(null);
  const [logs, setLogs] = useState([]);
  const [summary, setSummary] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!id) return;

    async function load() {
      try {
        const [jobData, logsData, summaryData] = await Promise.all([
          api.getJob(id),
          api.getJobLogs(id),
          api.getJobSummary(id).catch(() => null),
        ]);
        setJob(jobData);
        setLogs(logsData);
        setSummary(summaryData);
        setError('');
      } catch (err) {
        setError(err.message);
      }
    }

    load();
    const interval = setInterval(load, 5000);
    return () => clearInterval(interval);
  }, [id]);

  const blockedLogs = logs.filter((l) => l.status === 'blocked');
  const failedLogs = logs.filter((l) => l.status === 'failed');

  return (
    <Layout title={`Job #${id}`}>
      <Head>
        <title>Job {id} — LegalReach</title>
      </Head>

      <p style={{ marginBottom: '1.5rem' }}>
        <Link href="/">← Dashboard</Link>
        {' · '}
        <Link href={`/results/${id}`}>View results</Link>
      </p>

      {error && <p style={{ color: '#ef4444' }}>{error}</p>}

      {job && (
        <div style={cardStyle}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '1rem' }}>
            <Stat label="Status" value={job.status} color={STATUS_COLOR[job.status]} />
            <Stat label="Pages scraped" value={job.pages_scraped} />
            <Stat label="Records found" value={job.records_found} />
            <Stat label="Created" value={new Date(job.created_at + 'Z').toLocaleString()} />
          </div>
          <p style={{ marginTop: '1rem', fontSize: '0.9rem', color: '#64748b' }}>
            <strong>URL:</strong>{' '}
            <a href={job.url} target="_blank" rel="noopener noreferrer">{job.url}</a>
          </p>
          {job.label && (
            <p style={{ fontSize: '0.9rem', color: '#64748b' }}><strong>Label:</strong> {job.label}</p>
          )}
          {job.error_message && (
            <p style={{ marginTop: '0.75rem', color: '#f59e0b', fontSize: '0.9rem' }}>
              {job.error_message}
            </p>
          )}
          {summary?.page_type && (
            <p style={{ marginTop: '0.5rem', fontSize: '0.85rem', color: '#64748b' }}>
              Page type: <strong>{summary.page_type}</strong>
              {summary.duration_hint && ` · Duration: ${summary.duration_hint}`}
            </p>
          )}
          {summary?.issues?.length > 0 && (
            <ul style={{ marginTop: '0.5rem', fontSize: '0.85rem', color: '#f59e0b', paddingLeft: '1.25rem' }}>
              {summary.issues.map((issue, i) => <li key={i}>{issue}</li>)}
            </ul>
          )}
        </div>
      )}

      {blockedLogs.length > 0 && (
        <div style={{ ...cardStyle, borderLeft: '4px solid #ef4444' }}>
          <h2 style={sectionTitle}>Blocked pages ({blockedLogs.length})</h2>
          {blockedLogs.map((l) => (
            <div key={l.id} style={{ fontSize: '0.85rem', marginBottom: '0.5rem' }}>
              <a href={l.url} target="_blank" rel="noopener noreferrer">{l.url}</a>
              <span style={{ color: '#ef4444' }}> — {l.message}</span>
            </div>
          ))}
        </div>
      )}

      {failedLogs.length > 0 && (
        <div style={{ ...cardStyle, borderLeft: '4px solid #f59e0b' }}>
          <h2 style={sectionTitle}>Failed pages ({failedLogs.length})</h2>
          {failedLogs.map((l) => (
            <div key={l.id} style={{ fontSize: '0.85rem', marginBottom: '0.5rem' }}>
              <a href={l.url} target="_blank" rel="noopener noreferrer">{l.url}</a>
              <span style={{ color: '#f59e0b' }}> — {l.message}</span>
            </div>
          ))}
        </div>
      )}

      <div style={cardStyle}>
        <h2 style={sectionTitle}>Scrape log</h2>
        {logs.length === 0 ? (
          <p style={{ color: '#64748b' }}>No logs yet.</p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #e2e8f0', textAlign: 'left' }}>
                <th style={thStyle}>Status</th>
                <th style={thStyle}>Page type</th>
                <th style={thStyle}>URL</th>
                <th style={thStyle}>Message</th>
                <th style={thStyle}>Time</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((l) => (
                <tr key={l.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                  <td style={{ ...tdStyle, color: STATUS_COLOR[l.status] || '#64748b', fontWeight: 600 }}>
                    {l.status}
                  </td>
                  <td style={tdStyle}>{l.page_type || '—'}</td>
                  <td style={{ ...tdStyle, maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {l.url}
                  </td>
                  <td style={tdStyle}>{l.message || '—'}</td>
                  <td style={tdStyle}>{new Date(l.created_at + 'Z').toLocaleTimeString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </Layout>
  );
}

function Stat({ label, value, color }) {
  return (
    <div>
      <div style={{ fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 600 }}>{label}</div>
      <div style={{ fontSize: '1.1rem', fontWeight: 700, color: color || '#1e293b', textTransform: color ? 'uppercase' : 'none' }}>{value}</div>
    </div>
  );
}

const sectionTitle = { fontSize: '1rem', fontWeight: 600, marginBottom: '0.75rem' };