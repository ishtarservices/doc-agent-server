import express from 'express';
import organizationRoutes from './organizations';
import projectRoutes from './projects';
import agentRoutes from './agents';
import aiRoutes from './ai';
import taskRoutes from './tasks';
import columnRoutes from './columns';
import initRoutes from './init';
import { OrganizationController } from '../controllers/organizationController';
import { authenticateUser } from '../middleware/auth';

const router = express.Router();

// Health check endpoint
router.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    service: 'doc-agent-board-server',
    endpoints: [
      'GET /api/health',
      'POST /api/organizations',
      'GET /api/organizations/:organizationId',
      'PATCH /api/organizations/:organizationId',
      'DELETE /api/organizations/:organizationId',
      'GET /api/organizations/:organizationId/ai-usage',
      'GET /api/organizations/:organizationId/projects',
      'GET /api/organizations/:organizationId/agents',
      'POST /api/projects',
      'GET /api/projects/:projectId',
      'PATCH /api/projects/:projectId',
      'DELETE /api/projects/:projectId',
      'GET /api/projects/:projectId/context',
      'GET /api/projects/:projectId/tasks',
      'GET /api/projects/:projectId/columns',
      'POST /api/agents',
      'GET /api/agents/:agentId',
      'PATCH /api/agents/:agentId',
      'DELETE /api/agents/:agentId',
      'POST /api/ai/assistant',
      'POST /api/tasks',
      'GET /api/tasks/:taskId',
      'PATCH /api/tasks/:taskId',
      'DELETE /api/tasks/:taskId',
      'POST /api/tasks/:taskId/move',
      'POST /api/tasks/:taskId/assign-agent',
      'POST /api/tasks/:taskId/run-agent',
      'POST /api/columns',
      'GET /api/columns/:columnId',
      'PATCH /api/columns/:columnId',
      'DELETE /api/columns/:columnId',
      'GET /api/columns/:columnId/tasks',
      'GET /api/user/organizations',
    ],
  });
});

// User-specific routes (must come before parameterized routes)
router.get('/user/organizations', authenticateUser, OrganizationController.getOrganizationsByUser);

// Organization routes (includes /organizations/:organizationId/projects and /organizations/:organizationId/agents)
router.use('/organizations', organizationRoutes);

// Project routes
router.use('/projects', projectRoutes);

// Agent routes
router.use('/agents', agentRoutes);

// AI assistant routes
router.use('/ai', aiRoutes);

// Task routes
router.use('/tasks', taskRoutes);

// Column routes
router.use('/columns', columnRoutes);

// Initialization routes (no auth required)
router.use('/init', initRoutes);

export default router;