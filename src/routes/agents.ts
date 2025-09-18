import { Router } from 'express';
import { AgentController } from '../controllers/agentController';
import { authenticateUser } from '../middleware/auth';
import { requireAgentAccess } from '../middleware/authorization';

const router = Router();

// Apply authentication to all agent routes
router.use(authenticateUser);

// Agent CRUD operations
router.get('/:agentId', requireAgentAccess(), AgentController.getAgent);
router.post('/', AgentController.createAgent);
router.patch('/:agentId', requireAgentAccess(['owner', 'admin']), AgentController.updateAgent);
router.delete('/:agentId', requireAgentAccess(['owner', 'admin']), AgentController.deleteAgent);

export default router;