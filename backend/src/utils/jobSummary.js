export function buildJobSummary(job, logs) {
  const byStatus = {};
  for (const log of logs) {
    byStatus[log.status] = (byStatus[log.status] || 0) + 1;
  }

  const blocked = logs.filter((l) => l.status === 'blocked');
  const failed = logs.filter((l) => l.status === 'failed');
  const classified = logs.find((l) => l.status === 'classified');

  const issues = [];
  if (blocked.length > 0) issues.push(`${blocked.length} page(s) blocked`);
  if (failed.length > 0) issues.push(`${failed.length} page(s) failed`);
  if (job.records_found === 0) issues.push('No records extracted');
  if (job.error_message) issues.push(job.error_message);

  return {
    job_id: job.id,
    status: job.status,
    url: job.url,
    label: job.label,
    pages_scraped: job.pages_scraped,
    records_found: job.records_found,
    page_type: classified?.page_type || null,
    classification_reason: classified?.message || null,
    log_counts: byStatus,
    blocked_pages: blocked.map((l) => ({ url: l.url, message: l.message })),
    failed_pages: failed.map((l) => ({ url: l.url, message: l.message })),
    issues: [...new Set(issues)],
    completed_at: job.completed_at,
    duration_hint: job.completed_at && job.created_at
      ? `${Math.round((new Date(job.completed_at + 'Z') - new Date(job.created_at + 'Z')) / 1000)}s`
      : null,
  };
}