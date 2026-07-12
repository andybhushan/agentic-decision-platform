import { Router } from 'express';
import { githubReportingService } from '../services/githubReportingService';
import { GitHubReportingFilters } from '../types/githubReporting';

const router = Router();

// GET /api/v1/reporting/executive - Get executive status report from GitHub Project data
router.get('/executive', async (req, res, next) => {
  try {
    const reportingWindowDays = req.query.reportingWindowDays
      ? Number.parseInt(req.query.reportingWindowDays as string, 10)
      : undefined;

    const filters: GitHubReportingFilters = {
      owner: req.query.owner as string | undefined,
      projectNumber: req.query.projectNumber
        ? Number.parseInt(req.query.projectNumber as string, 10)
        : undefined,
      repository: req.query.repository as string | undefined,
      milestone: req.query.milestone as string | undefined,
      reportingWindowDays:
        Number.isFinite(reportingWindowDays) && reportingWindowDays && reportingWindowDays > 0
          ? reportingWindowDays
          : undefined,
    };

    const report = await githubReportingService.getExecutiveReport(filters);

    res.json({
      success: true,
      data: report,
      meta: {
        timestamp: new Date().toISOString(),
        filters: Object.fromEntries(
          Object.entries(filters).filter(([_, value]) => value !== undefined)
        ),
      },
    });
  } catch (error) {
    next(error);
  }
});

export default router;

// Made with Bob