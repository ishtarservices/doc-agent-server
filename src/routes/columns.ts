import { Router } from 'express';
import { ColumnController } from '../controllers/columnController';
import { authenticateUser } from '../middleware/auth';
import { requireColumnAccess } from '../middleware/authorization';

const router = Router();

// Apply authentication to all column routes
router.use(authenticateUser);

// Column CRUD operations
router.get('/:columnId', requireColumnAccess(), ColumnController.getColumn);
router.post('/', ColumnController.createColumn);
router.patch('/:columnId', requireColumnAccess(['owner', 'editor']), ColumnController.updateColumn);
router.delete('/:columnId', requireColumnAccess(['owner', 'editor']), ColumnController.deleteColumn);

// Column-specific endpoints
router.get('/:columnId/tasks', requireColumnAccess(), ColumnController.getColumnTasks);

export default router;