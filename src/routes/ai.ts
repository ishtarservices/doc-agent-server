import { Router, Response, NextFunction } from 'express';
import { EnhancedAIController } from '../controllers/aiController';
import { authenticateUser, AuthenticatedRequest } from '../middleware/auth';
import { requireProjectAccess } from '../middleware/authorization';

const router = Router();

// Apply authentication to all AI routes
router.use(authenticateUser);

// Custom middleware to extract projectId from request body for AI assistant
const requireProjectAccessFromBody = () => {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    // Extract projectId from body and put it in params for the authorization middleware
    if (req.body?.projectId) {
      req.params.projectId = req.body.projectId;
    }

    // Now call the standard project access middleware
    return requireProjectAccess()(req, res, next);
  };
};

// Create controller instance on-demand to avoid initialization timing issues
const getAIController = () => new EnhancedAIController();

/**
 * POST /api/ai/assistant
 * Process AI assistant request with full context
 * Requires project access since AI requests operate on project data
 */
router.post('/assistant', requireProjectAccessFromBody(), (req, res) => getAIController().processAIRequest(req, res));

/**
 * GET /api/ai/projects/:projectId/tasks
 * Get all tasks for a project (for context)
 * @deprecated - Use /projects/:projectId/context instead
 */
// router.get('/projects/:projectId/tasks', (req, res) => getAIController().getProjectTasks(req, res));

export default router;