import { Router } from 'express';
import { ProjectController } from '../controllers/projectController';
import { authenticateUser } from '../middleware/auth';
import { requireProjectAccess } from '../middleware/authorization';

const router = Router();

// Apply authentication to all project routes
router.use(authenticateUser);

// Project CRUD operations
router.get('/:projectId', requireProjectAccess(), ProjectController.getProject);
router.post('/', ProjectController.createProject);
router.patch('/:projectId', requireProjectAccess(['owner', 'editor']), ProjectController.updateProject);
router.delete('/:projectId', requireProjectAccess(['owner']), ProjectController.deleteProject);

// Project context (full project data with tasks, columns, agents, etc.)
router.get('/:projectId/context', requireProjectAccess(), ProjectController.getCurrentProjectContext);

// Project-specific resource endpoints
router.get('/:projectId/tasks', requireProjectAccess(), ProjectController.getProjectTasks);
router.get('/:projectId/columns', requireProjectAccess(), ProjectController.getProjectColumns);

export default router;