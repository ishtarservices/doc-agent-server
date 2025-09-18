import { Router } from 'express';
import { OrganizationController } from '../controllers/organizationController';
import { ProjectController } from '../controllers/projectController';
import { AgentController } from '../controllers/agentController';
import { authenticateUser } from '../middleware/auth';
import { requireOrganizationAccess } from '../middleware/authorization';

const router = Router();

// Apply authentication to all organization routes
router.use(authenticateUser);

// Organization CRUD operations
router.get('/:organizationId', requireOrganizationAccess(), OrganizationController.getOrganization);
router.post('/', OrganizationController.createOrganization);
router.patch('/:organizationId', requireOrganizationAccess(['owner', 'admin']), OrganizationController.updateOrganization);
router.delete('/:organizationId', requireOrganizationAccess(['owner']), OrganizationController.deleteOrganization);

// Organization-specific endpoints
router.get('/:organizationId/ai-usage', requireOrganizationAccess(), OrganizationController.getAIUsage);
router.get('/:organizationId/projects', requireOrganizationAccess(), ProjectController.getProjectsByOrganization);
router.get('/:organizationId/agents', requireOrganizationAccess(), AgentController.getAgentsByOrganization);

export default router;