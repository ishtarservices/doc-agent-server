import { Router } from 'express';
import { AIController } from '../controllers/aiController';
import { authenticateUser } from '../middleware/auth';

const router = Router();

// Apply authentication to all AI routes
router.use(authenticateUser);

// Create controller instance on-demand to avoid initialization timing issues
const getAIController = () => new AIController();

/**
 * POST /api/ai/assistant
 * Process AI assistant request with full context
 */
router.post('/assistant', (req, res) => getAIController().processAIRequest(req, res));

/**
 * GET /api/ai/projects/:projectId/tasks
 * Get all tasks for a project (for context)
 * @deprecated - Use /projects/:projectId/context instead
 */
router.get('/projects/:projectId/tasks', (req, res) => getAIController().getProjectTasks(req, res));

export default router;