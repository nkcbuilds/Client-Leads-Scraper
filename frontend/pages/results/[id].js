import { useState, useEffect, useMemo } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import Layout, { cardStyle, inputStyle, secondaryButtonStyle, thStyle, tdStyle } from '../../components/Layout';
import { api } from '../../lib/api';

export default function JobResults() {
  const router = useRouter();
  const { id } = router.query;
  const [job, setJob] = useState(null);
  const [people, setPeople] = useState([]);
  const [error, setError] = useState('');
  const [filterCompany, setFilterCompany] = useState('');
  const [filterConfidence, setFilterConfidence] = useState('');
  const [filterSource, setFilterSource] = useState('');
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (!id) return;

    async function load() {
      try {
        const [jobData, peopleData] = await Promise.all([
          api.getJob(id),
          api.getPeopleByJob(id),
        ]);
        setJob(jobData);
        setPeople(peopleData);
        setError('');
      } catch (err) {
        setError(err.message);
      }
    }

    load();
    const interval = setInterval(load, 5000);
    return () => clearInterval(interval);
  }, [id]);

  const companies = useMemo(() =>
    [...new Set(people.map((p) => p.company).filter(Boolean))].sort(),
  [people]);

  const sources = useMemo(() =>
    [...new Set(people.map((p) => p.source_site).filter(Boolean))].sort(),
  [people]);

  const filtered = useMemo(() => {
    return people.filter((p) => {
      if (filterCompany && p.company !== filterCompany) return false;
      if (filterConfidence && p.confidence_label !== filterConfidence) return false;
      if (filterSource && p.source_site !== filterSource) return false;
      if (search) {
        const q = search.toLowerCase();
        const hay = `${p.name} ${p.title} ${p.company} ${p.email}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [people, filterCompany, filterConfidence, filterSource, search]);

  const canExport = job && job.records_found > 0 && !['pending', 'running'].includes(job.status);

  return (
    <Layout title={`Job #${id} Results`}>
      <Head>
        <title>Job {id} Results — LegalReach</title>
      </Head>

      <p style={{ marginBottom: '1.5rem' }}>
        <Link href="/">← Dashboard</Link>
        {' · '}
        <Link href={`/jobs/${id}`}>View logs</Link>
      </p>

      {job && (
        <p style={{ color: '#64748b', marginTop: '-1rem', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
          {job.label || job.url} — <strong>{job.status}</strong> — {job.records_found} records from {job.pages_scraped} pages
        </p>
      )}

      {error && <p style={{ color: '#ef4444' }}>{error}</p>}

      {canExport && (
        <div style={{ ...cardStyle, display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>Export:</span>
          <a href={api.exportUrl(id, 'csv')} style={secondaryButtonStyle}>CSV</a>
          <a href={api.exportUrl(id, 'xlsx')} style={secondaryButtonStyle}>Excel</a>
          <a href={api.exportUrl(id, 'json')} style={secondaryButtonStyle}>JSON</a>
          <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Files also saved to backend/output/</span>
        </div>
      )}

      {people.length > 0 && (
        <div style={{ ...cardStyle, display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <label style={{ flex: '1 1 160px' }}>
            <span style={labelStyle}>Search</span>
            <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Name, title, email..." style={inputStyle} />
          </label>
          <label style={{ flex: '0 1 160px' }}>
            <span style={labelStyle}>Company</span>
            <select value={filterCompany} onChange={(e) => setFilterCompany(e.target.value)} style={inputStyle}>
              <option value="">All</option>
              {companies.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </label>
          <label style={{ flex: '0 1 140px' }}>
            <span style={labelStyle}>Confidence</span>
            <select value={filterConfidence} onChange={(e) => setFilterConfidence(e.target.value)} style={inputStyle}>
              <option value="">All</option>
              {['HIGH', 'MEDIUM', 'LOW', 'UNVERIFIED'].map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </label>
          <label style={{ flex: '0 1 140px' }}>
            <span style={labelStyle}>Source</span>
            <select value={filterSource} onChange={(e) => setFilterSource(e.target.value)} style={inputStyle}>
              <option value="">All</option>
              {sources.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </label>
          <span style={{ fontSize: '0.85rem', color: '#64748b', paddingBottom: '0.6rem' }}>
            Showing {filtered.length} of {people.length}
          </span>
        </div>
      )}

      {people.length === 0 ? (
        <div style={cardStyle}>
          <p style={{ color: '#64748b' }}>
            {job?.status === 'running' || job?.status === 'pending'
              ? 'Job still running — results will appear here...'
              : 'No people records extracted yet.'}
          </p>
          {job?.error_message && (
            <p style={{ color: '#f59e0b', marginTop: '0.5rem', fontSize: '0.9rem' }}>{job.error_message}</p>
          )}
        </div>
      ) : (
        <div style={cardStyle}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #e2e8f0', textAlign: 'left' }}>
                <th style={thStyle}>Name</th>
                <th style={thStyle}>Title</th>
                <th style={thStyle}>Company</th>
                <th style={thStyle}>Email</th>
                <th style={thStyle}>Domain</th>
                <th style={thStyle}>LinkedIn</th>
                <th style={thStyle}>Confidence</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => (
                <tr key={p.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                  <td style={tdStyle}>{p.name}</td>
                  <td style={tdStyle}>{p.title || '—'}</td>
                  <td style={tdStyle}>{p.company || '—'}</td>
                  <td style={tdStyle}>
                    {p.email ? (
                      <span title={p.email_status}>{p.email}{p.email_status === 'guessed' ? ' *' : ''}</span>
                    ) : '—'}
                  </td>
                  <td style={tdStyle}>{p.company_domain || '—'}</td>
                  <td style={tdStyle}>
                    {p.linkedin_url ? (
                      <a href={p.linkedin_url} target="_blank" rel="noopener noreferrer">View</a>
                    ) : '—'}
                  </td>
                  <td style={tdStyle}>
                    <span title={p.confidence_label || ''}>
                      {p.confidence_label || '—'} ({((p.overall_confidence || p.llm_confidence) * 100).toFixed(0)}%)
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Layout>
  );
}

const labelStyle = { display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#64748b', marginBottom: '0.25rem' };