import { Router } from 'express';
import { getJobById } from '../db/jobs.js';
import { getEnrichedPeopleByJob } from '../db/contacts.js';
import { exportToCsv } from '../exporters/csv.js';
import { exportToJson } from '../exporters/json.js';
import { exportToExcelBuffer } from '../exporters/excel.js';
import fs from 'fs';
import path from 'path';
import { getSetting } from '../db/settings.js';

const router = Router({ mergeParams: true });

function sanitizeFilename(name) {
  return (name || 'leads').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 60);
}

router.get('/:id/export', (req, res) => {
  try {
    const job = getJobById(req.params.id);
    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    const format = (req.query.format || 'csv').toLowerCase();
    const records = getEnrichedPeopleByJob(req.params.id);

    if (records.length === 0) {
      return res.status(404).json({ error: 'No records to export for this job' });
    }

    const baseName = sanitizeFilename(job.label || `job_${job.id}`);
    const meta = { job_id: job.id, job_url: job.url, job_label: job.label };

    if (format === 'json') {
      const json = exportToJson(records, meta);
      const outputPath = getSetting('output_path', './output');
      if (!fs.existsSync(outputPath)) fs.mkdirSync(outputPath, { recursive: true });
      const filePath = path.join(outputPath, `${baseName}_${job.id}.json`);
      fs.writeFileSync(filePath, json, 'utf8');

      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="${baseName}_${job.id}.json"`);
      return res.send(json);
    }

    if (format === 'xlsx' || format === 'excel') {
      const buffer = exportToExcelBuffer(records);
      const outputPath = getSetting('output_path', './output');
      if (!fs.existsSync(outputPath)) fs.mkdirSync(outputPath, { recursive: true });
      const filePath = path.join(outputPath, `${baseName}_${job.id}.xlsx`);
      fs.writeFileSync(filePath, buffer);

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${baseName}_${job.id}.xlsx"`);
      return res.send(buffer);
    }

    if (format === 'csv') {
      const csv = exportToCsv(records);
      const outputPath = getSetting('output_path', './output');
      if (!fs.existsSync(outputPath)) fs.mkdirSync(outputPath, { recursive: true });
      const filePath = path.join(outputPath, `${baseName}_${job.id}.csv`);
      fs.writeFileSync(filePath, csv, 'utf8');

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${baseName}_${job.id}.csv"`);
      return res.send(csv);
    }

    return res.status(400).json({ error: 'Invalid format. Use csv, xlsx, or json' });
  } catch (err) {
    res.status(500).json({ error: 'Export failed' });
  }
});

export default router;