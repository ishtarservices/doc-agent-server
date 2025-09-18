import { Router } from 'express';
import { TaskController } from '../controllers/taskController';
import { authenticateUser } from '../middleware/auth';
import { requireTaskAccess } from '../middleware/authorization';

const router = Router();

// Apply authentication to all task routes
router.use(authenticateUser);

// Task CRUD operations
router.get('/:taskId', requireTaskAccess(), TaskController.getTask);
router.post('/', TaskController.createTask);
router.patch('/:taskId', requireTaskAccess(['owner', 'editor']), TaskController.updateTask);
router.delete('/:taskId', requireTaskAccess(['owner', 'editor']), TaskController.deleteTask);

// Task-specific operations
router.post('/:taskId/move', requireTaskAccess(['owner', 'editor']), TaskController.moveTask);
router.post('/:taskId/assign-agent', requireTaskAccess(['owner', 'editor']), TaskController.assignAgent);
router.post('/:taskId/run-agent', requireTaskAccess(['owner', 'editor']), TaskController.runAgent);

export default router;