import { Router } from 'express';
import { MongoService } from '../services/mongoService';
import { Response, Request } from 'express';

const router = Router();

// Create service instance on-demand
const getMongoService = () => new MongoService();

// Create a basic project structure for testing (minimal sample data)
router.post('/sample-project', async (req: Request, res: Response) => {
  try {
    const mongoService = getMongoService();
    const { 
      organizationName = 'Test Organization',
      projectName = 'Test Project',
      userId = 'test_user_1'
    } = req.body;

    console.log('Creating sample project structure...');

    // Create organization
    const organization = await mongoService.createOrganization({
      name: organizationName,
      slug: organizationName.toLowerCase().replace(/\s+/g, '-'),
      description: 'Test organization created for development'
    }, userId);

    // Create project
    const project = await mongoService.createProject({
      organizationId: organization._id,
      name: projectName,
      description: 'Test project for development and testing'
    }, userId);

    // Create basic columns
    const columnData = [
      { title: 'Backlog', name: 'backlog', color: '#6b7280' },
      { title: 'In Progress', name: 'in_progress', color: '#f59e0b' },
      { title: 'Done', name: 'done', color: '#10b981' },
    ];

    const columns = [];
    for (const colData of columnData) {
      const column = await mongoService.createColumn({
        projectId: project._id,
        title: colData.title,
        name: colData.name,
        color: colData.color
      }, userId);
      columns.push(column);
    }

    res.json({
      success: true,
      message: 'Sample project created successfully',
      data: {
        organization: {
          id: organization._id,
          name: organization.name,
          slug: organization.slug
        },
        project: {
          id: project._id,
          name: project.name
        },
        columns: columns.map(c => ({
          id: c._id,
          title: c.title,
          name: c.name
        }))
      }
    });

  } catch (error) {
    console.error('Sample Project Creation Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create sample project',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Clear all data (for development/testing)
router.delete('/clear-all', async (req: Request, res: Response) => {
  try {
    const mongoService = getMongoService();
    const db = mongoService['db'];

    console.log('Clearing all collections...');

    const collections = ['tasks', 'columns', 'projects', 'organizations', 'agents'];
    const results = await Promise.all(
      collections.map(async (collectionName) => {
        const result = await db.collection(collectionName).deleteMany({});
        return { collection: collectionName, deletedCount: result.deletedCount };
      })
    );

    res.json({
      success: true,
      message: 'All data cleared successfully',
      results,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Clear All Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to clear data',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get project context (for testing frontend integration)
router.get('/project/:projectId/context', async (req: Request, res: Response) => {
  try {
    const mongoService = getMongoService();
    const { projectId } = req.params;

    const context = await mongoService.getProjectContext(projectId);
    
    if (!context) {
      return res.status(404).json({
        success: false,
        error: 'Project not found',
        message: `Project with ID ${projectId} does not exist`
      });
    }

    res.json({
      success: true,
      data: context,
      metadata: {
        totalTasks: context.tasks.length,
        totalColumns: context.columns.length,
        totalAgents: context.agents.length,
        totalMembers: context.members.length
      }
    });

  } catch (error) {
    console.error('Get Project Context Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get project context',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Health check for database connection
router.get('/health', async (req: Request, res: Response) => {
  try {
    const mongoService = getMongoService();
    const db = mongoService['db'];
    
    // Test database connection
    await db.admin().ping();
    
    res.json({
      success: true,
      message: 'Database connection healthy',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Database connection failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Debug endpoint (for development only)
router.get('/debug', async (req: Request, res: Response) => {
  try {
    const mongoService = getMongoService();
    const db = mongoService['db'];

    const [organizations, projects, columns, tasks, agents] = await Promise.all([
      db.collection('organizations').find({}).limit(10).toArray(),
      db.collection('projects').find({}).limit(10).toArray(),
      db.collection('columns').find({}).limit(20).toArray(),
      db.collection('tasks').find({}).limit(50).toArray(),
      db.collection('agents').find({}).limit(10).toArray()
    ]);

    res.json({
      success: true,
      data: {
        summary: {
          organizations: organizations.length,
          projects: projects.length,
          columns: columns.length,
          tasks: tasks.length,
          agents: agents.length
        },
        // Only return IDs and basic info to avoid exposing sensitive data
        organizations: organizations.map(org => ({
          id: org._id?.toString(),
          name: org.name,
          slug: org.slug,
          isActive: org.isActive
        })),
        projects: projects.map(proj => ({
          id: proj._id?.toString(),
          name: proj.name,
          organizationId: proj.organizationId,
          isActive: proj.isActive
        })),
        columns: columns.map(col => ({
          id: col._id?.toString(),
          title: col.title,
          projectId: col.projectId
        })),
        tasks: tasks.map(task => ({
          id: task._id?.toString(),
          title: task.title,
          type: task.type,
          status: task.status
        })),
        agents: agents.map(agent => ({
          id: agent._id?.toString(),
          name: agent.name,
          type: agent.type
        }))
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Debug Error:', error);
    res.status(500).json({
      success: false,
      error: 'Debug failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;