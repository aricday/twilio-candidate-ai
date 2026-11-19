// Read-only endpoints for the stub iCIMS data shown in the UI.
import { Router } from 'express';
import { CANDIDATES, getCandidate, getRecord, JOB } from '../ats/store';

export const atsRouter = Router();

atsRouter.get('/api/job', (_req, res) => {
  res.json(JOB);
});

atsRouter.get('/api/candidates', (_req, res) => {
  res.json(CANDIDATES);
});

atsRouter.get('/api/ats/records/:candidateId', (req, res) => {
  res.json(getRecord(getCandidate(req.params.candidateId).id));
});
