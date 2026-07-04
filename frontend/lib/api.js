export const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

async function request(path, options = {}) {
  const res = await fetch(`${API_URL}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || 'Request failed');
  }
  return res.json();
}

export const api = {
  health: () => request('/api/health'),
  getJobs: () => request('/api/jobs'),
  getJob: (id) => request(`/api/jobs/${id}`),
  getJobLogs: (id) => request(`/api/jobs/${id}/logs`),
  getJobSummary: (id) => request(`/api/jobs/${id}/summary`),
  createJob: (data) => request('/api/jobs', { method: 'POST', body: JSON.stringify(data) }),
  exportUrl: (jobId, format) => `${API_URL}/api/jobs/${jobId}/export?format=${format}`,
  getPeopleByJob: (jobId, enriched = true) =>
    request(`/api/people/job/${jobId}${enriched ? '?enriched=true' : ''}`),
  getPeople: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/api/people${qs ? `?${qs}` : ''}`);
  },
  getSettings: () => request('/api/settings'),
  updateSettings: (data) => request('/api/settings', { method: 'PUT', body: JSON.stringify(data) }),
};