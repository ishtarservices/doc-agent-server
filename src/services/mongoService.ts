import { ObjectId } from 'mongodb';
import MongoDB from '../config/mongodb';
import type {
  OrganizationData,
  OrganizationDocument,
  ProjectData,
  ProjectDocument,
  AgentData,
  AgentDocument,
  ColumnData,
  ColumnDocument,
  TaskData,
  TaskDocument,
  ProjectContext,
  CreateOrganizationRequest,
  UpdateOrganizationRequest,
  CreateProjectRequest,
  UpdateProjectRequest,
  CreateAgentRequest,
  UpdateAgentRequest,
  CreateColumnRequest,
  UpdateColumnRequest,
  CreateTaskRequest,
  UpdateTaskRequest,
} from '../types';

export class MongoService {
  private get db() {
    return MongoDB.getInstance().getDb();
  }

  // Helper methods to convert MongoDB documents to API format
  private documentToOrganization(doc: OrganizationDocument): OrganizationData {
    return {
      _id: doc._id!.toString(),
      name: doc.name,
      slug: doc.slug,
      description: doc.description,
      logo: doc.logo,
      settings: doc.settings,
      members: doc.members,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
      isActive: doc.isActive,
    };
  }

  private documentToProject(doc: ProjectDocument): ProjectData {
    return {
      _id: doc._id!.toString(),
      organizationId: doc.organizationId,
      name: doc.name,
      description: doc.description,
      settings: doc.settings,
      visibility: doc.visibility,
      members: doc.members,
      createdBy: doc.createdBy,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
      isActive: doc.isActive,
      isArchived: doc.isArchived,
    };
  }

  private documentToAgent(doc: AgentDocument): AgentData {
    return {
      _id: doc._id!.toString(),
      name: doc.name,
      description: doc.description,
      type: doc.type,
      logo: doc.logo,
      model: doc.model,
      systemPrompt: doc.systemPrompt,
      settings: doc.settings,
      capabilities: doc.capabilities,
      organizationId: doc.organizationId,
      createdBy: doc.createdBy,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
      isActive: doc.isActive,
      isPublic: doc.isPublic,
    };
  }

  private documentToColumn(doc: ColumnDocument): ColumnData {
    return {
      _id: doc._id!.toString(),
      projectId: doc.projectId,
      title: doc.title,
      name: doc.name,
      description: doc.description,
      color: doc.color,
      position: doc.position,
      settings: doc.settings,
      visibility: doc.visibility,
      createdBy: doc.createdBy,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
    };
  }

  private documentToTask(doc: TaskDocument): TaskData {
    return {
      _id: doc._id!.toString(),
      projectId: doc.projectId,
      columnId: doc.columnId,
      title: doc.title,
      description: doc.description,
      type: doc.type,
      status: doc.status,
      priority: doc.priority,
      agents: doc.agents || [],
      agentHistory: doc.agentHistory,
      tokenEstimate: doc.tokenEstimate,
      actualTokensUsed: doc.actualTokensUsed,
      progressPercentage: doc.progressPercentage,
      assignees: doc.assignees,
      tags: doc.tags,
      position: doc.position,
      dependencies: doc.dependencies,
      blockedBy: doc.blockedBy,
      subtasks: doc.subtasks,
      parentTask: doc.parentTask,
      dueDate: doc.dueDate,
      estimatedDuration: doc.estimatedDuration,
      timeSpent: doc.timeSpent,
      createdBy: doc.createdBy,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
      lastAgentRun: doc.lastAgentRun,
      completedAt: doc.completedAt,
    };
  }

  // ============================================================================
  // ORGANIZATION METHODS
  // ============================================================================

  public async createOrganization(data: CreateOrganizationRequest, createdBy: string): Promise<OrganizationData> {
    const now = new Date();
    
    // Check if slug already exists
    const existingOrg = await this.db.collection('organizations').findOne({ slug: data.slug });
    if (existingOrg) {
      throw new Error(`Organization with slug '${data.slug}' already exists`);
    }

    const doc: OrganizationDocument = {
      name: data.name,
      slug: data.slug,
      description: data.description,
      logo: data.logo,
      settings: {
        defaultColumns: ['backlog', 'ready', 'in_progress', 'done'],
        aiCredits: 10000,
        maxProjects: 10,
        features: ['ai_agents', 'auto_run']
      },
      members: [{
        userId: createdBy,
        role: 'owner',
        joinedAt: now,
        permissions: ['*']
      }],
      createdAt: now,
      updatedAt: now,
      isActive: true,
    };

    const result = await this.db.collection('organizations').insertOne(doc);
    doc._id = result.insertedId;

    return this.documentToOrganization(doc);
  }

  public async getOrganization(organizationId: string): Promise<OrganizationData | null> {
    if (!ObjectId.isValid(organizationId)) {
      throw new Error('Invalid organization ID format');
    }

    const doc = await this.db.collection('organizations')
      .findOne({ _id: new ObjectId(organizationId), isActive: true }) as OrganizationDocument | null;

    return doc ? this.documentToOrganization(doc) : null;
  }

  public async updateOrganization(organizationId: string, updates: UpdateOrganizationRequest): Promise<OrganizationData | null> {
    if (!ObjectId.isValid(organizationId)) {
      throw new Error('Invalid organization ID format');
    }

    const updateDoc = {
      ...updates,
      updatedAt: new Date(),
    };

    const result = await this.db.collection('organizations').findOneAndUpdate(
      { _id: new ObjectId(organizationId), isActive: true },
      { $set: updateDoc },
      { returnDocument: 'after' }
    );

    return result ? this.documentToOrganization(result as OrganizationDocument) : null;
  }

  public async deleteOrganization(organizationId: string): Promise<boolean> {
    if (!ObjectId.isValid(organizationId)) {
      throw new Error('Invalid organization ID format');
    }

    // Soft delete by setting isActive to false
    const result = await this.db.collection('organizations').updateOne(
      { _id: new ObjectId(organizationId) },
      { $set: { isActive: false, updatedAt: new Date() } }
    );
    return result.modifiedCount === 1;
  }

  public async getOrganizationsByUser(userId: string): Promise<OrganizationData[]> {
    const docs = await this.db.collection('organizations')
      .find({
        'members.userId': userId,
        isActive: true
      })
      .sort({ createdAt: -1 })
      .toArray() as OrganizationDocument[];

    return docs.map(doc => this.documentToOrganization(doc));
  }

  // Get organization with user access check
  public async getOrganizationForUser(organizationId: string, userId: string): Promise<OrganizationData | null> {
    if (!ObjectId.isValid(organizationId)) {
      throw new Error('Invalid organization ID format');
    }

    const doc = await this.db.collection('organizations')
      .findOne({
        _id: new ObjectId(organizationId),
        'members.userId': userId,
        isActive: true
      }) as OrganizationDocument | null;

    return doc ? this.documentToOrganization(doc) : null;
  }

  // Check if user has access to organization
  public async hasOrganizationAccess(organizationId: string, userId: string): Promise<boolean> {
    if (!ObjectId.isValid(organizationId)) {
      return false;
    }

    const count = await this.db.collection('organizations')
      .countDocuments({
        _id: new ObjectId(organizationId),
        'members.userId': userId,
        isActive: true
      });

    return count > 0;
  }

  // ============================================================================
  // PROJECT METHODS
  // ============================================================================

  public async createProject(data: CreateProjectRequest, createdBy: string): Promise<ProjectData> {
    if (!ObjectId.isValid(data.organizationId)) {
      throw new Error('Invalid organization ID format');
    }

    // Verify organization exists and user has access
    const organization = await this.getOrganization(data.organizationId);
    if (!organization) {
      throw new Error('Organization not found');
    }

    const now = new Date();
    const doc: ProjectDocument = {
      organizationId: data.organizationId,
      name: data.name,
      description: data.description,
      settings: {
        autoRunEnabled: false,
        aiModel: 'claude-3-5-sonnet',
        tokenBudget: 10000,
        ...data.settings
      },
      visibility: data.visibility || 'team',
      members: [{
        userId: createdBy,
        role: 'owner',
        addedAt: now
      }],
      createdBy,
      createdAt: now,
      updatedAt: now,
      isActive: true,
      isArchived: false,
    };

    const result = await this.db.collection('projects').insertOne(doc);
    doc._id = result.insertedId;

    return this.documentToProject(doc);
  }

  public async getProject(projectId: string): Promise<ProjectData | null> {
    if (!ObjectId.isValid(projectId)) {
      throw new Error('Invalid project ID format');
    }

    const doc = await this.db.collection('projects')
      .findOne({ 
        _id: new ObjectId(projectId), 
        isActive: true 
      }) as ProjectDocument | null;

    return doc ? this.documentToProject(doc) : null;
  }

  public async updateProject(projectId: string, updates: UpdateProjectRequest): Promise<ProjectData | null> {
    if (!ObjectId.isValid(projectId)) {
      throw new Error('Invalid project ID format');
    }

    const updateDoc = {
      ...updates,
      updatedAt: new Date(),
    };

    const result = await this.db.collection('projects').findOneAndUpdate(
      { _id: new ObjectId(projectId), isActive: true },
      { $set: updateDoc },
      { returnDocument: 'after' }
    );

    return result ? this.documentToProject(result as ProjectDocument) : null;
  }

  public async deleteProject(projectId: string): Promise<boolean> {
    if (!ObjectId.isValid(projectId)) {
      throw new Error('Invalid project ID format');
    }

    // Soft delete by setting isActive to false
    const result = await this.db.collection('projects').updateOne(
      { _id: new ObjectId(projectId) },
      { $set: { isActive: false, updatedAt: new Date() } }
    );
    return result.modifiedCount === 1;
  }

  public async getProjectsByOrganization(organizationId: string): Promise<ProjectData[]> {
    if (!ObjectId.isValid(organizationId)) {
      throw new Error('Invalid organization ID format');
    }

    const docs = await this.db.collection('projects')
      .find({ organizationId, isActive: true })
      .sort({ createdAt: -1 })
      .toArray() as ProjectDocument[];

    return docs.map(doc => this.documentToProject(doc));
  }

  // Get projects by organization with user access check
  public async getProjectsByOrganizationForUser(organizationId: string, userId: string): Promise<ProjectData[]> {
    if (!ObjectId.isValid(organizationId)) {
      throw new Error('Invalid organization ID format');
    }

    // First check if user has access to organization
    const hasAccess = await this.hasOrganizationAccess(organizationId, userId);
    if (!hasAccess) {
      return [];
    }

    const docs = await this.db.collection('projects')
      .find({
        organizationId,
        isActive: true,
        $or: [
          { visibility: 'public' },
          { visibility: 'team' },
          { 'members.userId': userId }
        ]
      })
      .sort({ createdAt: -1 })
      .toArray() as ProjectDocument[];

    return docs.map(doc => this.documentToProject(doc));
  }

  // Get project with user access check
  public async getProjectForUser(projectId: string, userId: string): Promise<ProjectData | null> {
    if (!ObjectId.isValid(projectId)) {
      throw new Error('Invalid project ID format');
    }

    const project = await this.getProject(projectId);
    if (!project) return null;

    // Check organization access
    const hasOrgAccess = await this.hasOrganizationAccess(project.organizationId, userId);
    if (!hasOrgAccess) return null;

    // Check project-specific access
    if (project.visibility === 'private') {
      const hasProjectAccess = project.members.some(member => member.userId === userId);
      if (!hasProjectAccess) return null;
    }

    return project;
  }

  // Check if user has access to project
  public async hasProjectAccess(projectId: string, userId: string): Promise<boolean> {
    if (!ObjectId.isValid(projectId)) {
      return false;
    }

    const project = await this.getProject(projectId);
    if (!project) return false;

    // Check organization access first
    const hasOrgAccess = await this.hasOrganizationAccess(project.organizationId, userId);
    if (!hasOrgAccess) return false;

    // If project is private, check project membership
    if (project.visibility === 'private') {
      return project.members.some(member => member.userId === userId);
    }

    return true;
  }

  public async getProjectContext(projectId: string): Promise<ProjectContext | null> {
    const project = await this.getProject(projectId);
    if (!project) return null;

    const organization = await this.getOrganization(project.organizationId);
    if (!organization) return null;

    const [tasks, columns, agents] = await Promise.all([
      this.getTasksByProject(projectId),
      this.getColumnsByProject(projectId),
      this.getAgentsByOrganization(project.organizationId),
    ]);

    // Group tasks by column
    const columnsWithTasks = columns.map(column => ({
      ...column,
      tasks: tasks.filter(task => task.columnId === column._id)
        .sort((a, b) => a.position - b.position)
    }));

    // Get actual project members - for now returning organization members
    // TODO: Implement user service to get actual user details
    const members = organization.members.map(member => ({
      userId: member.userId,
      name: `User ${member.userId}`, // Replace with actual user service call
      email: `${member.userId}@example.com`, // Replace with actual user service call
      role: member.role,
    }));

    return {
      organization,
      project,
      tasks,  // Keep flat array for backward compatibility
      columns: columnsWithTasks,  // Enhanced columns with tasks
      agents,
      members,
    };
  }

  // ============================================================================
  // AGENT METHODS
  // ============================================================================

  public async createAgent(data: CreateAgentRequest, createdBy: string): Promise<AgentData> {
    if (!ObjectId.isValid(data.organizationId)) {
      throw new Error('Invalid organization ID format');
    }

    // Verify organization exists
    const organization = await this.getOrganization(data.organizationId);
    if (!organization) {
      throw new Error('Organization not found');
    }

    const now = new Date();
    const doc: AgentDocument = {
      name: data.name,
      description: data.description,
      type: data.type,
      logo: data.logo,
      model: data.model,
      systemPrompt: data.systemPrompt,
      settings: {
        maxTokens: 4000,
        temperature: 0.3,
        autoRun: false,
        retryAttempts: 2,
        timeout: 30,
        ...data.settings,
      },
      capabilities: data.capabilities || [],
      organizationId: data.organizationId,
      createdBy,
      createdAt: now,
      updatedAt: now,
      isActive: true,
      isPublic: data.isPublic || false,
    };

    const result = await this.db.collection('agents').insertOne(doc);
    doc._id = result.insertedId;

    return this.documentToAgent(doc);
  }

  public async getAgent(agentId: string): Promise<AgentData | null> {
    if (!ObjectId.isValid(agentId)) {
      throw new Error('Invalid agent ID format');
    }

    const doc = await this.db.collection('agents')
      .findOne({ 
        _id: new ObjectId(agentId), 
        isActive: true 
      }) as AgentDocument | null;

    return doc ? this.documentToAgent(doc) : null;
  }

  public async updateAgent(agentId: string, updates: UpdateAgentRequest): Promise<AgentData | null> {
    if (!ObjectId.isValid(agentId)) {
      throw new Error('Invalid agent ID format');
    }

    const updateDoc = {
      ...updates,
      updatedAt: new Date(),
    };

    const result = await this.db.collection('agents').findOneAndUpdate(
      { _id: new ObjectId(agentId), isActive: true },
      { $set: updateDoc },
      { returnDocument: 'after' }
    );

    return result ? this.documentToAgent(result as AgentDocument) : null;
  }

  public async deleteAgent(agentId: string): Promise<boolean> {
    if (!ObjectId.isValid(agentId)) {
      throw new Error('Invalid agent ID format');
    }

    // Soft delete by setting isActive to false
    const result = await this.db.collection('agents').updateOne(
      { _id: new ObjectId(agentId) },
      { $set: { isActive: false, updatedAt: new Date() } }
    );
    return result.modifiedCount === 1;
  }

  public async getAgentsByOrganization(organizationId: string): Promise<AgentData[]> {
    if (!ObjectId.isValid(organizationId)) {
      throw new Error('Invalid organization ID format');
    }

    const docs = await this.db.collection('agents')
      .find({ organizationId, isActive: true })
      .sort({ createdAt: -1 })
      .toArray() as AgentDocument[];

    return docs.map(doc => this.documentToAgent(doc));
  }

  // ============================================================================
  // COLUMN METHODS
  // ============================================================================

  public async createColumn(data: CreateColumnRequest, createdBy: string): Promise<ColumnData> {
    if (!ObjectId.isValid(data.projectId)) {
      throw new Error('Invalid project ID format');
    }

    // Verify project exists
    const project = await this.getProject(data.projectId);
    if (!project) {
      throw new Error('Project not found');
    }

    // Get next position if not provided
    let position = data.position;
    if (position === undefined) {
      const maxPosition = await this.db.collection('columns')
        .findOne(
          { projectId: data.projectId },
          { sort: { position: -1 } }
        ) as ColumnDocument | null;

      position = maxPosition ? maxPosition.position + 1 : 0;
    }

    const now = new Date();
    const doc: ColumnDocument = {
      projectId: data.projectId,
      title: data.title,
      name: data.name,
      description: data.description,
      color: data.color || '#6b7280',
      position,
      settings: {
        isCollapsed: false,
        isPinned: false,
        autoRun: false,
        taskLimit: 50,
        ...data.settings,
      },
      visibility: data.visibility || 'public',
      createdBy,
      createdAt: now,
      updatedAt: now,
    };

    const result = await this.db.collection('columns').insertOne(doc);
    doc._id = result.insertedId;

    return this.documentToColumn(doc);
  }

  public async getColumn(columnId: string): Promise<ColumnData | null> {
    if (!ObjectId.isValid(columnId)) {
      throw new Error('Invalid column ID format');
    }

    const doc = await this.db.collection('columns')
      .findOne({ _id: new ObjectId(columnId) }) as ColumnDocument | null;

    return doc ? this.documentToColumn(doc) : null;
  }

  public async updateColumn(columnId: string, updates: UpdateColumnRequest): Promise<ColumnData | null> {
    if (!ObjectId.isValid(columnId)) {
      throw new Error('Invalid column ID format');
    }

    const updateDoc = {
      ...updates,
      updatedAt: new Date(),
    };

    const result = await this.db.collection('columns').findOneAndUpdate(
      { _id: new ObjectId(columnId) },
      { $set: updateDoc },
      { returnDocument: 'after' }
    );

    return result ? this.documentToColumn(result as ColumnDocument) : null;
  }

  public async deleteColumn(columnId: string): Promise<boolean> {
    if (!ObjectId.isValid(columnId)) {
      throw new Error('Invalid column ID format');
    }

    // First, delete all tasks in this column
    await this.db.collection('tasks').deleteMany({ columnId });

    // Then delete the column
    const result = await this.db.collection('columns').deleteOne({ _id: new ObjectId(columnId) });
    return result.deletedCount === 1;
  }

  public async getColumnsByProject(projectId: string): Promise<ColumnData[]> {
    if (!ObjectId.isValid(projectId)) {
      throw new Error('Invalid project ID format');
    }

    const docs = await this.db.collection('columns')
      .find({ projectId })
      .sort({ position: 1 })
      .toArray() as ColumnDocument[];

    return docs.map(doc => this.documentToColumn(doc));
  }

  // ============================================================================
  // TASK METHODS
  // ============================================================================

  public async createTask(data: CreateTaskRequest, createdBy: string): Promise<TaskData> {
    if (!ObjectId.isValid(data.projectId)) {
      throw new Error('Invalid project ID format');
    }
    if (!ObjectId.isValid(data.columnId)) {
      throw new Error('Invalid column ID format');
    }

    // Verify project and column exist
    const [project, column] = await Promise.all([
      this.getProject(data.projectId),
      this.getColumn(data.columnId)
    ]);

    if (!project) {
      throw new Error('Project not found');
    }
    if (!column) {
      throw new Error('Column not found');
    }

    // Get next position within the column
    const maxPosition = await this.db.collection('tasks')
      .findOne(
        { projectId: data.projectId, columnId: data.columnId },
        { sort: { position: -1 } }
      ) as TaskDocument | null;

    const position = maxPosition ? maxPosition.position + 1 : 0;

    const now = new Date();
    const doc: TaskDocument = {
      projectId: data.projectId,
      columnId: data.columnId,
      title: data.title,
      description: data.description,
      type: data.type,
      status: data.status || 'backlog',
      priority: data.priority || 'medium',
      agents: data.agents || [],
      agentHistory: data.agents && data.agents.length > 0 ? data.agents.map(agent => ({
        agentId: agent.agentId,
        assignedAt: now,
        assignedBy: createdBy
      })) : [],
      tokenEstimate: data.tokenEstimate || 0,
      actualTokensUsed: 0,
      progressPercentage: 0,
      assignees: data.assignees?.map(assignee => ({
        userId: assignee.userId,
        name: `User ${assignee.userId}`, // TODO: Get from user service
        email: `${assignee.userId}@example.com`, // TODO: Get from user service
        role: assignee.role,
        assignedAt: now,
        initials: assignee.userId.substring(0, 2).toUpperCase() // TODO: Generate from actual name
      })) || [],
      tags: data.tags || [],
      position,
      dependencies: data.dependencies || [],
      blockedBy: [],
      subtasks: [],
      parentTask: data.parentTask,
      dueDate: data.dueDate,
      estimatedDuration: data.estimatedDuration,
      timeSpent: 0,
      createdBy,
      createdAt: now,
      updatedAt: now,
    };

    const result = await this.db.collection('tasks').insertOne(doc);
    doc._id = result.insertedId;

    return this.documentToTask(doc);
  }

  public async getTask(taskId: string): Promise<TaskData | null> {
    if (!ObjectId.isValid(taskId)) {
      throw new Error('Invalid task ID format');
    }

    const doc = await this.db.collection('tasks')
      .findOne({ _id: new ObjectId(taskId) }) as TaskDocument | null;

    return doc ? this.documentToTask(doc) : null;
  }

  public async updateTask(taskId: string, updates: UpdateTaskRequest): Promise<TaskData | null> {
    if (!ObjectId.isValid(taskId)) {
      throw new Error('Invalid task ID format');
    }

    const updateDoc: any = {
      ...updates,
      updatedAt: new Date(),
    };

    // Handle agent assignment change
    if (updates.agents) {
      // Agent history is typically handled in the controller when agents are assigned
      // but we can also handle direct updates here if needed
      updateDoc.agents = updates.agents;
    }

    const result = await this.db.collection('tasks').findOneAndUpdate(
      { _id: new ObjectId(taskId) },
      updateDoc.$push ? updateDoc : { $set: updateDoc },
      { returnDocument: 'after' }
    );

    return result ? this.documentToTask(result as TaskDocument) : null;
  }

  public async deleteTask(taskId: string): Promise<boolean> {
    if (!ObjectId.isValid(taskId)) {
      throw new Error('Invalid task ID format');
    }

    const result = await this.db.collection('tasks').deleteOne({ _id: new ObjectId(taskId) });
    return result.deletedCount === 1;
  }

  public async getTasksByProject(projectId: string): Promise<TaskData[]> {
    if (!ObjectId.isValid(projectId)) {
      throw new Error('Invalid project ID format');
    }

    const docs = await this.db.collection('tasks')
      .find({ projectId })
      .sort({ position: 1 })
      .toArray() as TaskDocument[];

    return docs.map(doc => this.documentToTask(doc));
  }

  public async getTasksByColumn(columnId: string): Promise<TaskData[]> {
    if (!ObjectId.isValid(columnId)) {
      throw new Error('Invalid column ID format');
    }

    const docs = await this.db.collection('tasks')
      .find({ columnId })
      .sort({ position: 1 })
      .toArray() as TaskDocument[];

    return docs.map(doc => this.documentToTask(doc));
  }

  public async moveTask(taskId: string, newColumnId: string, newPosition?: number): Promise<TaskData | null> {
    if (!ObjectId.isValid(taskId)) {
      throw new Error('Invalid task ID format');
    }
    if (!ObjectId.isValid(newColumnId)) {
      throw new Error('Invalid column ID format');
    }

    // Verify column exists
    const column = await this.getColumn(newColumnId);
    if (!column) {
      throw new Error('Target column not found');
    }

    const updates: any = {
      columnId: newColumnId,
      updatedAt: new Date(),
    };

    if (newPosition !== undefined) {
      updates.position = newPosition;
    } else {
      // Get next position in the new column
      const maxPosition = await this.db.collection('tasks')
        .findOne(
          { columnId: newColumnId },
          { sort: { position: -1 } }
        ) as TaskDocument | null;

      updates.position = maxPosition ? maxPosition.position + 1 : 0;
    }

    const result = await this.db.collection('tasks').findOneAndUpdate(
      { _id: new ObjectId(taskId) },
      { $set: updates },
      { returnDocument: 'after' }
    );

    return result ? this.documentToTask(result as TaskDocument) : null;
  }
}