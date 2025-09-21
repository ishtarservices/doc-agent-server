import { Router } from 'express';
import { AgentController } from '../controllers/agentController';
import { authenticateUser } from '../middleware/auth';
import { requireAgentAccess } from '../middleware/authorization';

const router = Router();

// Apply authentication to all agent routes
router.use(authenticateUser);

// Available Agents (from external server/registry)
router.get('/available', AgentController.getAvailableAgents);

// Agent CRUD operations
router.get('/:agentId', requireAgentAccess(), AgentController.getAgent);
router.post('/', AgentController.createAgent);
router.patch('/:agentId', requireAgentAccess(['owner', 'admin']), AgentController.updateAgent);
router.delete('/:agentId', requireAgentAccess(['owner', 'admin']), AgentController.deleteAgent);

// Agent assignment and execution routes
router.post('/assign/:taskId', AgentController.assignAgentsToTask);
router.post('/run/:taskId', AgentController.runAgent);

export default router;