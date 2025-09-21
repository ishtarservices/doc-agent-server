// AI Tools System - src/services/aiTools.ts

import { ObjectId } from 'mongodb';
import type { MongoService } from './mongoService';
import type {
  TaskData,
  ColumnData,
  ProjectData,
  CreateTaskRequest,
  CreateColumnRequest,
  CreateProjectRequest,
  UpdateTaskRequest,
  UpdateColumnRequest
} from '../types';
import type { AITool, AIToolContext, AIToolResult } from '../types/ai';
import { Logger } from '../utils/logger';

export class AIToolsService {
  private mongoService: MongoService;
  private tools: Map<string, AITool> = new Map();

  constructor(mongoService: MongoService) {
    this.mongoService = mongoService;
    this.initializeTools();
  }

  private initializeTools() {
    // Project Management Tools
    this.registerTool(this.createProjectTool());
    this.registerTool(this.getProjectInfoTool());
    this.registerTool(this.updateProjectTool());
    
    // Task Management Tools
    this.registerTool(this.createTaskTool());
    this.registerTool(this.updateTaskTool());
    this.registerTool(this.deleteTaskTool());
    this.registerTool(this.moveTaskTool());
    this.registerTool(this.searchTasksTool());
    this.registerTool(this.analyzeTasksTool());
    
    // Column Management Tools
    this.registerTool(this.createColumnTool());
    this.registerTool(this.updateColumnTool());
    this.registerTool(this.deleteColumnTool());
    
    // Agent Tools (placeholders for future implementation)
    this.registerTool(this.assignAgentTool());
    this.registerTool(this.runAgentTool());
    
    // Analytics Tools
    this.registerTool(this.getProjectAnalyticsTool());
    this.registerTool(this.getTaskStatsTool());
  }

  private registerTool(tool: AITool) {
    this.tools.set(tool.name, tool);
  }

  public getAvailableTools(): AITool[] {
    return Array.from(this.tools.values());
  }

  public async executeTool(toolName: string, parameters: any, context: AIToolContext): Promise<AIToolResult> {
    const tool = this.tools.get(toolName);
    if (!tool) {
      Logger.warn('🛠️ Unknown tool requested', undefined, {
        toolName,
        availableTools: Array.from(this.tools.keys()),
        projectId: context.projectId
      });
      return {
        success: false,
        error: `Tool '${toolName}' not found`
      };
    }

    const startTime = Date.now();
    Logger.info(`🛠️ Executing tool: ${toolName}`, undefined, {
      toolName,
      parameters,
      projectId: context.projectId,
      userId: context.userId
    });

    try {
      const result = await tool.execute(parameters, {
        ...context,
        mongoService: this.mongoService
      });

      Logger.info(`✅ Tool executed successfully: ${toolName}`, undefined, {
        toolName,
        executionTime: Date.now() - startTime,
        resultType: typeof result,
        projectId: context.projectId
      });

      return {
        success: true,
        data: result
      };
    } catch (error) {
      Logger.error(`❌ Tool execution failed: ${toolName}`, undefined, error, {
        toolName,
        parameters,
        executionTime: Date.now() - startTime,
        projectId: context.projectId,
        errorType: error instanceof Error ? error.name : 'Unknown'
      });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  // ============================================================================
  // PROJECT MANAGEMENT TOOLS
  // ============================================================================

  private createProjectTool(): AITool {
    return {
      name: 'create_project',
      description: 'Create a new project in the current organization',
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Project name' },
          description: { type: 'string', description: 'Project description' },
          visibility: { 
            type: 'string', 
            enum: ['public', 'private', 'team'],
            description: 'Project visibility level'
          }
        },
        required: ['name']
      },
      execute: async (params, context) => {
        const projectData: CreateProjectRequest = {
          organizationId: context.organizationId,
          name: params.name,
          description: params.description,
          visibility: params.visibility || 'team'
        };

        const project = await context.mongoService.createProject(projectData, context.userId);
        
        // Create default columns for the new project
        const defaultColumns = ['Backlog', 'Ready', 'In Progress', 'Done'];
        for (let i = 0; i < defaultColumns.length; i++) {
          await context.mongoService.createColumn({
            projectId: project._id,
            title: defaultColumns[i],
            name: defaultColumns[i].toLowerCase().replace(/\s+/g, '_'),
            color: this.getDefaultColumnColor(i),
            position: i
          }, context.userId);
        }

        return project;
      }
    };
  }

  private getProjectInfoTool(): AITool {
    return {
      name: 'get_project_info',
      description: 'Get detailed information about the current project',
      parameters: {
        type: 'object',
        properties: {
          includeStats: { type: 'boolean', description: 'Include task statistics' }
        },
        required: []
      },
      execute: async (params, context) => {
        const projectContext = await context.mongoService.getProjectContext(context.projectId);
        
        if (params.includeStats) {
          const stats = await this.calculateProjectStats(projectContext, context);
          return { ...projectContext, stats };
        }
        
        return projectContext;
      }
    };
  }

  private updateProjectTool(): AITool {
    return {
      name: 'update_project',
      description: 'Update project properties',
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'New project name' },
          description: { type: 'string', description: 'New project description' },
          visibility: { 
            type: 'string', 
            enum: ['public', 'private', 'team'],
            description: 'New visibility level'
          }
        },
        required: []
      },
      execute: async (params, context) => {
        return await context.mongoService.updateProject(context.projectId, params);
      }
    };
  }

  // ============================================================================
  // TASK MANAGEMENT TOOLS
  // ============================================================================

  private createTaskTool(): AITool {
    return {
      name: 'create_task',
      description: 'Create a new task in the project',
      parameters: {
        type: 'object',
        properties: {
          title: { type: 'string', description: 'Task title' },
          description: { type: 'string', description: 'Task description' },
          type: {
            type: 'string',
            enum: ['email', 'doc', 'code', 'research', 'design', 'legal', 'finance', 'bug', 'test', 'infra', 'outreach', 'custom'],
            description: 'Task type'
          },
          priority: {
            type: 'string',
            enum: ['low', 'medium', 'high', 'urgent'],
            description: 'Task priority'
          },
          status: {
            type: 'string',
            enum: ['backlog', 'ready', 'in_progress', 'done', 'blocked', 'cancelled'],
            description: 'Task status for smart column placement'
          },
          columnId: { type: 'string', description: 'Column ID to create task in' },
          columnName: { type: 'string', description: 'Column name (alternative to columnId)' },
          tokenEstimate: { type: 'number', description: 'Estimated tokens for task completion' },
          dueDate: { type: 'string', description: 'Due date in ISO format' },
          tags: { type: 'array', items: { type: 'string' }, description: 'Task tags' }
        },
        required: ['title']
      },
      execute: async (params, context) => {
        let columnId = params.columnId;

        // Enhanced column selection logic
        if (!columnId && params.columnName) {
          const columns = await context.mongoService.getColumnsByProject(context.projectId);
          const column = columns.find((col: ColumnData) =>
            col.name.toLowerCase() === params.columnName.toLowerCase() ||
            col.title.toLowerCase() === params.columnName.toLowerCase()
          );
          columnId = column?._id;
        }

        // Smart default based on task status
        if (!columnId) {
          const columns = await context.mongoService.getColumnsByProject(context.projectId);

          // Try to find appropriate column based on common patterns
          const defaultMappings: Record<string, string[]> = {
            'backlog': ['backlog', 'todo', 'ideas', 'new'],
            'ready': ['ready', 'to do', 'todo', 'planned'],
            'in_progress': ['in progress', 'doing', 'wip', 'active', 'working'],
            'done': ['done', 'completed', 'finished', 'complete'],
            'blocked': ['blocked', 'waiting', 'hold'],
            'cancelled': ['cancelled', 'canceled', 'rejected']
          };

          // If task has a status, try to match it to a column
          if (params.status) {
            const patterns = defaultMappings[params.status] || [];
            for (const pattern of patterns) {
              const matchedColumn = columns.find((col: ColumnData) =>
                col.title.toLowerCase().includes(pattern) ||
                col.name.toLowerCase().includes(pattern)
              );
              if (matchedColumn) {
                columnId = matchedColumn._id;
                break;
              }
            }
          }

          // If no status-based match, try to find common column patterns
          if (!columnId) {
            const commonPatterns = ['backlog', 'todo', 'ready', 'new'];
            for (const pattern of commonPatterns) {
              const matchedColumn = columns.find((col: ColumnData) =>
                col.title.toLowerCase().includes(pattern) ||
                col.name.toLowerCase().includes(pattern)
              );
              if (matchedColumn) {
                columnId = matchedColumn._id;
                break;
              }
            }
          }

          // Final fallback: use first column
          if (!columnId) {
            columnId = columns[0]?._id;
          }
        }

        if (!columnId) {
          throw new Error('No columns found in project. Create columns first.');
        }

        const taskData: CreateTaskRequest = {
          projectId: context.projectId,
          columnId,
          title: params.title,
          description: params.description,
          type: params.type || 'custom',
          status: params.status || 'backlog',
          priority: params.priority || 'medium',
          tokenEstimate: params.tokenEstimate || 500,
          dueDate: params.dueDate ? new Date(params.dueDate) : undefined,
          tags: params.tags || []
        };

        return await context.mongoService.createTask(taskData, context.userId);
      }
    };
  }

  private updateTaskTool(): AITool {
    return {
      name: 'update_task',
      description: 'Update an existing task',
      parameters: {
        type: 'object',
        properties: {
          taskId: { type: 'string', description: 'Task ID to update' },
          title: { type: 'string', description: 'New task title' },
          description: { type: 'string', description: 'New task description' },
          priority: {
            type: 'string',
            enum: ['low', 'medium', 'high', 'urgent'],
            description: 'New task priority'
          },
          status: {
            type: 'string',
            enum: ['backlog', 'ready', 'in_progress', 'done', 'blocked', 'cancelled'],
            description: 'New task status'
          },
          progressPercentage: { type: 'number', description: 'Task completion percentage (0-100)' },
          tags: { type: 'array', items: { type: 'string' }, description: 'Task tags' }
        },
        required: ['taskId']
      },
      execute: async (params, context) => {
        const { taskId, ...updates } = params;
        return await context.mongoService.updateTask(taskId, updates);
      }
    };
  }

  private deleteTaskTool(): AITool {
    return {
      name: 'delete_task',
      description: 'Delete a task from the project',
      parameters: {
        type: 'object',
        properties: {
          taskId: { type: 'string', description: 'Task ID to delete' }
        },
        required: ['taskId']
      },
      execute: async (params, context) => {
        const success = await context.mongoService.deleteTask(params.taskId);
        return { deleted: success, taskId: params.taskId };
      }
    };
  }

  private moveTaskTool(): AITool {
    return {
      name: 'move_task',
      description: 'Move a task to a different column',
      parameters: {
        type: 'object',
        properties: {
          taskId: { type: 'string', description: 'Task ID to move' },
          columnId: { type: 'string', description: 'Target column ID' },
          columnName: { type: 'string', description: 'Target column name (alternative to columnId)' },
          position: { type: 'number', description: 'Position in the target column' }
        },
        required: ['taskId']
      },
      execute: async (params, context) => {
        let columnId = params.columnId;
        
        if (!columnId && params.columnName) {
          const columns = await context.mongoService.getColumnsByProject(context.projectId);
          const column: ColumnData | undefined = columns.find((col: ColumnData) => 
            col.name.toLowerCase() === params.columnName.toLowerCase() ||
            col.title.toLowerCase() === params.columnName.toLowerCase()
          );
          columnId = column?._id;
        }
        
        if (!columnId) {
          throw new Error('Target column not found');
        }

        return await context.mongoService.moveTask(params.taskId, columnId, params.position);
      }
    };
  }

  private searchTasksTool(): AITool {
    return {
      name: 'search_tasks',
      description: 'Search for tasks using various criteria',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Text to search in title and description' },
          status: { type: 'string', description: 'Filter by task status' },
          priority: { type: 'string', description: 'Filter by task priority' },
          type: { type: 'string', description: 'Filter by task type' },
          agentId: { type: 'string', description: 'Filter by specific agent ID' },
          tags: { type: 'array', items: { type: 'string' }, description: 'Filter by tags' },
          limit: { type: 'number', description: 'Maximum number of results' }
        },
        required: []
      },
      execute: async (params, context) => {
        // Get all tasks for the project first
        const allTasks = await context.mongoService.getTasksByProject(context.projectId);

        let filteredTasks = allTasks;

        // Apply filters
        if (params.query) {
          const queryLower = params.query.toLowerCase();
          filteredTasks = filteredTasks.filter((task: TaskData) =>
            task.title.toLowerCase().includes(queryLower) ||
            (task.description && task.description.toLowerCase().includes(queryLower))
          );
        }

        if (params.status) {
          filteredTasks = filteredTasks.filter((task: TaskData) => task.status === params.status);
        }

        if (params.priority) {
          filteredTasks = filteredTasks.filter((task: TaskData) => task.priority === params.priority);
        }

        if (params.type) {
          filteredTasks = filteredTasks.filter((task: TaskData) => task.type === params.type);
        }

        if (params.agentId) {
          filteredTasks = filteredTasks.filter((task: TaskData) =>
            task.agents && task.agents.some(agent => agent.agentId === params.agentId)
          );
        }

        if (params.tags && params.tags.length > 0) {
          filteredTasks = filteredTasks.filter((task: TaskData) =>
            params.tags.some((tag: string) => task.tags.includes(tag))
          );
        }

        // Sort by creation date (newest first) and limit results
        const sortedTasks = filteredTasks
          .sort((a: TaskData, b: TaskData) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
          .slice(0, params.limit || 50);

        return sortedTasks;
      }
    };
  }

  private analyzeTasksTool(): AITool {
    return {
      name: 'analyze_tasks',
      description: 'Analyze project tasks and provide insights',
      parameters: {
        type: 'object',
        properties: {
          analysisType: {
            type: 'string',
            enum: ['progress', 'workload', 'bottlenecks', 'completion_time', 'priority_distribution'],
            description: 'Type of analysis to perform'
          },
          timeframe: { type: 'string', description: 'Time frame for analysis (e.g., "7d", "30d", "3m")' }
        },
        required: ['analysisType']
      },
      execute: async (params, context) => {
        const tasks = await context.mongoService.getTasksByProject(context.projectId);
        
        switch (params.analysisType) {
          case 'progress':
            return this.analyzeProgress(tasks);
          case 'workload':
            return this.analyzeWorkload(tasks);
          case 'bottlenecks':
            return this.analyzeBottlenecks(tasks);
          case 'completion_time':
            return this.analyzeCompletionTime(tasks, params.timeframe);
          case 'priority_distribution':
            return this.analyzePriorityDistribution(tasks);
          default:
            throw new Error(`Unknown analysis type: ${params.analysisType}`);
        }
      }
    };
  }

  // ============================================================================
  // COLUMN MANAGEMENT TOOLS
  // ============================================================================

  private createColumnTool(): AITool {
    return {
      name: 'create_column',
      description: 'Create a new column in the project board',
      parameters: {
        type: 'object',
        properties: {
          title: { type: 'string', description: 'Column title' },
          name: { type: 'string', description: 'Column name (URL-friendly identifier)' },
          description: { type: 'string', description: 'Column description' },
          color: { type: 'string', description: 'Column color (hex code)' },
          position: { type: 'number', description: 'Column position (0-based)' },
          autoRun: { type: 'boolean', description: 'Whether to auto-run agents on tasks moved to this column' }
        },
        required: ['title']
      },
      execute: async (params, context) => {
        const columnData: CreateColumnRequest = {
          projectId: context.projectId,
          title: params.title,
          name: params.name || params.title.toLowerCase().replace(/\s+/g, '_'),
          description: params.description,
          color: params.color || this.getRandomColumnColor(),
          position: params.position,
          settings: {
            isCollapsed: false,
            isPinned: false,
            autoRun: params.autoRun || false,
            taskLimit: 50
          }
        };

        return await context.mongoService.createColumn(columnData, context.userId);
      }
    };
  }

  private updateColumnTool(): AITool {
    return {
      name: 'update_column',
      description: 'Update an existing column',
      parameters: {
        type: 'object',
        properties: {
          columnId: { type: 'string', description: 'Column ID to update' },
          title: { type: 'string', description: 'New column title' },
          description: { type: 'string', description: 'New column description' },
          color: { type: 'string', description: 'New column color' },
          autoRun: { type: 'boolean', description: 'Whether to enable auto-run' }
        },
        required: ['columnId']
      },
      execute: async (params, context) => {
        const { columnId, ...updates } = params;
        
        if (updates.autoRun !== undefined) {
          updates.settings = { autoRun: updates.autoRun };
          delete updates.autoRun;
        }

        return await context.mongoService.updateColumn(columnId, updates);
      }
    };
  }

  private deleteColumnTool(): AITool {
    return {
      name: 'delete_column',
      description: 'Delete a column and all its tasks',
      parameters: {
        type: 'object',
        properties: {
          columnId: { type: 'string', description: 'Column ID to delete' }
        },
        required: ['columnId']
      },
      execute: async (params, context) => {
        const success = await context.mongoService.deleteColumn(params.columnId);
        return { deleted: success, columnId: params.columnId };
      }
    };
  }

  // ============================================================================
  // AGENT TOOLS (Placeholders for future implementation)
  // ============================================================================

  private assignAgentTool(): AITool {
    return {
      name: 'assign_agent',
      description: 'Assign an AI agent to a task',
      parameters: {
        type: 'object',
        properties: {
          taskId: { type: 'string', description: 'Task ID to assign agent to' },
          agentId: { type: 'string', description: 'Agent ID to assign' },
          autoRun: { type: 'boolean', description: 'Whether to run the agent immediately' }
        },
        required: ['taskId', 'agentId']
      },
      execute: async (params, context) => {
        // Placeholder for agent assignment logic
        // TODO: Implement agent assignment when agent system is ready
        return {
          success: true,
          message: 'Agent assignment functionality coming soon',
          taskId: params.taskId,
          agentId: params.agentId
        };
      }
    };
  }

  private runAgentTool(): AITool {
    return {
      name: 'run_agent',
      description: 'Execute an agent on a task',
      parameters: {
        type: 'object',
        properties: {
          taskId: { type: 'string', description: 'Task ID to run agent on' },
          agentId: { type: 'string', description: 'Specific agent to run (optional)' }
        },
        required: ['taskId']
      },
      execute: async (params, context) => {
        // Placeholder for agent execution logic
        // TODO: Implement agent execution when agent system is ready
        return {
          success: true,
          message: 'Agent execution functionality coming soon',
          taskId: params.taskId,
          agentId: params.agentId
        };
      }
    };
  }

  // ============================================================================
  // ANALYTICS TOOLS
  // ============================================================================

  private getProjectAnalyticsTool(): AITool {
    return {
      name: 'get_project_analytics',
      description: 'Get comprehensive project analytics and insights',
      parameters: {
        type: 'object',
        properties: {
          timeframe: { type: 'string', description: 'Analysis timeframe (7d, 30d, 3m, 6m, 1y)' },
          includeCharts: { type: 'boolean', description: 'Include chart data' }
        },
        required: []
      },
      execute: async (params, context) => {
        const projectContext = await context.mongoService.getProjectContext(context.projectId);
        const analytics = await this.calculateProjectAnalytics(projectContext, params.timeframe);
        
        return {
          project: projectContext.project,
          analytics,
          generatedAt: new Date()
        };
      }
    };
  }

  private getTaskStatsTool(): AITool {
    return {
      name: 'get_task_stats',
      description: 'Get detailed task statistics',
      parameters: {
        type: 'object',
        properties: {
          groupBy: {
            type: 'string',
            enum: ['status', 'priority', 'type', 'assignee', 'column'],
            description: 'How to group the statistics'
          }
        },
        required: []
      },
      execute: async (params, context) => {
        const tasks = await context.mongoService.getTasksByProject(context.projectId);
        return this.calculateTaskStats(tasks, params.groupBy);
      }
    };
  }

  // ============================================================================
  // UTILITY METHODS
  // ============================================================================

  private getDefaultColumnColor(index: number): string {
    const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];
    return colors[index % colors.length];
  }

  private getRandomColumnColor(): string {
    const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#84cc16'];
    return colors[Math.floor(Math.random() * colors.length)];
  }

  private async calculateProjectStats(projectContext: any, context: AIToolContext) {
    const tasks = projectContext.tasks || [];
    const columns = projectContext.columns || [];

    return {
      totalTasks: tasks.length,
      tasksByStatus: this.groupBy(tasks, 'status'),
      tasksByPriority: this.groupBy(tasks, 'priority'),
      tasksByType: this.groupBy(tasks, 'type'),
      totalColumns: columns.length,
      averageTasksPerColumn: tasks.length / Math.max(columns.length, 1),
      completionRate: this.calculateCompletionRate(tasks),
      avgTokensPerTask: this.calculateAverageTokens(tasks)
    };
  }

  private analyzeProgress(tasks: TaskData[]) {
    const completedTasks = tasks.filter(t => t.status === 'done').length;
    const totalTasks = tasks.length;
    const inProgressTasks = tasks.filter(t => t.status === 'in_progress').length;
    const blockedTasks = tasks.filter(t => t.status === 'blocked').length;

    return {
      completionRate: totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0,
      completedTasks,
      totalTasks,
      inProgressTasks,
      blockedTasks,
      readyTasks: tasks.filter(t => t.status === 'ready').length,
      backlogTasks: tasks.filter(t => t.status === 'backlog').length
    };
  }

  private analyzeWorkload(tasks: TaskData[]) {
    const workloadByAssignee = this.groupBy(
      tasks.flatMap(t => t.assignees || []),
      'userId'
    );

    return {
      totalAssignees: Object.keys(workloadByAssignee).length,
      workloadDistribution: workloadByAssignee,
      unassignedTasks: tasks.filter(t => !t.assignees || t.assignees.length === 0).length,
      avgTasksPerAssignee: tasks.length / Math.max(Object.keys(workloadByAssignee).length, 1)
    };
  }

  private analyzeBottlenecks(tasks: TaskData[]) {
    const tasksByColumn = this.groupBy(tasks, 'columnId');
    const bottlenecks = Object.entries(tasksByColumn)
      .filter(([_, tasks]) => (tasks as any[]).length > 10)
      .map(([columnId, tasks]) => ({
        columnId,
        taskCount: (tasks as any[]).length,
        oldestTask: Math.min(...(tasks as any[]).map((t: any) => new Date(t.createdAt).getTime()))
      }));

    return {
      bottlenecks,
      blockedTasks: tasks.filter(t => t.status === 'blocked'),
      overdueTasks: tasks.filter(t => t.dueDate && new Date(t.dueDate) < new Date())
    };
  }

  private analyzeCompletionTime(tasks: TaskData[], timeframe?: string) {
    const completedTasks = tasks.filter(t => t.status === 'done' && t.completedAt);
    
    const completionTimes = completedTasks.map(t => {
      if (t.completedAt && t.createdAt) {
        return new Date(t.completedAt).getTime() - new Date(t.createdAt).getTime();
      }
      return 0;
    }).filter(time => time > 0);

    return {
      avgCompletionTime: completionTimes.length > 0 
        ? completionTimes.reduce((sum, time) => sum + time, 0) / completionTimes.length 
        : 0,
      medianCompletionTime: this.calculateMedian(completionTimes),
      minCompletionTime: Math.min(...completionTimes),
      maxCompletionTime: Math.max(...completionTimes),
      totalCompletedTasks: completedTasks.length
    };
  }

  private analyzePriorityDistribution(tasks: TaskData[]) {
    return {
      distribution: this.groupBy(tasks, 'priority'),
      urgentTasks: tasks.filter(t => t.priority === 'urgent'),
      highPriorityTasks: tasks.filter(t => t.priority === 'high'),
      recommendedPrioritization: this.suggestPrioritization(tasks)
    };
  }

  private async calculateProjectAnalytics(projectContext: any, timeframe?: string) {
    const tasks = projectContext.tasks || [];
    
    return {
      overview: this.analyzeProgress(tasks),
      workload: this.analyzeWorkload(tasks),
      bottlenecks: this.analyzeBottlenecks(tasks),
      completion: this.analyzeCompletionTime(tasks, timeframe),
      priorities: this.analyzePriorityDistribution(tasks),
      trends: await this.calculateTrends(tasks, timeframe)
    };
  }

  private calculateTaskStats(tasks: TaskData[], groupBy?: string) {
    const stats = {
      total: tasks.length,
      byStatus: this.groupBy(tasks, 'status'),
      byPriority: this.groupBy(tasks, 'priority'),
      byType: this.groupBy(tasks, 'type')
    };

    if (groupBy) {
      return {
        ...stats,
        groupedBy: groupBy,
        groups: this.groupBy(tasks, groupBy)
      };
    }

    return stats;
  }

  private calculateTrends(tasks: TaskData[], timeframe?: string) {
    // Simplified trend calculation - in a real implementation,
    // this would analyze historical data from the database
    const now = new Date();
    const days = timeframe === '7d' ? 7 : timeframe === '30d' ? 30 : 30;
    const startDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

    const recentTasks = tasks.filter(t => 
      new Date(t.createdAt) >= startDate
    );

    return {
      tasksCreated: recentTasks.length,
      tasksCompleted: recentTasks.filter(t => t.status === 'done').length,
      avgTasksPerDay: recentTasks.length / days,
      trend: 'stable' // This would be calculated based on historical data
    };
  }

  private groupBy(array: any[], key: string) {
    return array.reduce((groups, item) => {
      const group = item[key] || 'unknown';
      groups[group] = groups[group] || [];
      groups[group].push(item);
      return groups;
    }, {});
  }

  private calculateCompletionRate(tasks: TaskData[]): number {
    if (tasks.length === 0) return 0;
    const completed = tasks.filter(t => t.status === 'done').length;
    return (completed / tasks.length) * 100;
  }

  private calculateAverageTokens(tasks: TaskData[]): number {
    const tasksWithTokens = tasks.filter(t => t.actualTokensUsed > 0);
    if (tasksWithTokens.length === 0) return 0;
    
    const totalTokens = tasksWithTokens.reduce((sum, t) => sum + t.actualTokensUsed, 0);
    return totalTokens / tasksWithTokens.length;
  }

  private calculateMedian(numbers: number[]): number {
    if (numbers.length === 0) return 0;
    
    const sorted = [...numbers].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    
    return sorted.length % 2 === 0
      ? (sorted[mid - 1] + sorted[mid]) / 2
      : sorted[mid];
  }

  private suggestPrioritization(tasks: TaskData[]): string[] {
    const suggestions: string[] = [];
    
    const urgentCount = tasks.filter(t => t.priority === 'urgent').length;
    const overdueCount = tasks.filter(t => 
      t.dueDate && new Date(t.dueDate) < new Date()
    ).length;
    
    if (urgentCount > tasks.length * 0.3) {
      suggestions.push('Consider re-evaluating urgent priority assignments - over 30% of tasks are marked urgent');
    }
    
    if (overdueCount > 0) {
      suggestions.push(`${overdueCount} tasks are overdue and should be prioritized`);
    }
    
    return suggestions;
  }
}