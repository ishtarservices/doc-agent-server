import { supabaseAdmin, createUserSupabaseClient } from '../config/supabase';
import { TaskData, DatabaseTask, ColumnData } from '../types';

export class TaskService {
  public async getTasksByProject(projectId: string, userId: string): Promise<TaskData[]> {
    try {
      const { data: tasks, error } = await supabaseAdmin
        .from('tasks')
        .select('*')
        .eq('project_id', projectId)
        .eq('created_by', userId)
        .order('position', { ascending: true });

      if (error) {
        console.error('Database error fetching tasks:', error);
        throw new Error(`Failed to fetch tasks: ${error.message}`);
      }

      return tasks?.map(this.mapDatabaseTaskToTaskData) || [];
    } catch (error) {
      console.error('Task Service Error (getTasksByProject):', error);
      throw error;
    }
  }

  public async createTask(
    task: Omit<TaskData, 'id'>,
    accessToken: string
  ): Promise<TaskData> {
    try {
      const userClient = createUserSupabaseClient(accessToken);

      // Get the highest position for this project
      const { data: maxPositionData } = await supabaseAdmin
        .from('tasks')
        .select('position')
        .eq('project_id', task.project_id)
        .order('position', { ascending: false })
        .limit(1);

      const nextPosition = maxPositionData?.[0]?.position ? maxPositionData[0].position + 1 : 0;

      const taskToInsert = {
        title: task.title,
        description: task.description || null,
        type: task.type,
        status: task.status,
        token_estimate: task.token_estimate || null,
        project_id: task.project_id,
        created_by: task.created_by,
        position: nextPosition,
      };

      const { data, error } = await userClient
        .from('tasks')
        .insert(taskToInsert)
        .select()
        .single();

      if (error) {
        console.error('Database error creating task:', error);
        throw new Error(`Failed to create task: ${error.message}`);
      }

      return this.mapDatabaseTaskToTaskData(data);
    } catch (error) {
      console.error('Task Service Error (createTask):', error);
      throw error;
    }
  }

  public async createMultipleTasks(
    tasks: Omit<TaskData, 'id'>[],
    accessToken: string
  ): Promise<TaskData[]> {
    try {
      const userClient = createUserSupabaseClient(accessToken);

      if (!tasks.length) return [];

      // Get the highest position for this project
      const projectId = tasks[0].project_id;
      const { data: maxPositionData } = await supabaseAdmin
        .from('tasks')
        .select('position')
        .eq('project_id', projectId)
        .order('position', { ascending: false })
        .limit(1);

      let nextPosition = maxPositionData?.[0]?.position ? maxPositionData[0].position + 1 : 0;

      const tasksToInsert = tasks.map((task) => ({
        title: task.title,
        description: task.description || null,
        type: task.type,
        status: task.status,
        token_estimate: task.token_estimate || null,
        project_id: task.project_id,
        created_by: task.created_by,
        position: nextPosition++,
      }));

      const { data, error } = await userClient
        .from('tasks')
        .insert(tasksToInsert)
        .select();

      if (error) {
        console.error('Database error creating multiple tasks:', error);
        throw new Error(`Failed to create tasks: ${error.message}`);
      }

      return data?.map(this.mapDatabaseTaskToTaskData) || [];
    } catch (error) {
      console.error('Task Service Error (createMultipleTasks):', error);
      throw error;
    }
  }

  public async getProjectContext(projectId: string, userId: string): Promise<{
    tasks: TaskData[];
    columns: ColumnData[];
  }> {
    try {
      const tasks = await this.getTasksByProject(projectId, userId);

      // Group tasks by status (columns)
      const columns: ColumnData[] = [
        {
          id: 'backlog',
          title: 'Backlog',
          tasks: tasks.filter(t => t.status === 'backlog')
        },
        {
          id: 'ready',
          title: 'Ready',
          tasks: tasks.filter(t => t.status === 'ready')
        },
        {
          id: 'in_progress',
          title: 'In Progress',
          tasks: tasks.filter(t => t.status === 'in_progress')
        },
        {
          id: 'done',
          title: 'Done',
          tasks: tasks.filter(t => t.status === 'done')
        },
      ];

      return { tasks, columns };
    } catch (error) {
      console.error('Task Service Error (getProjectContext):', error);
      throw error;
    }
  }

  private mapDatabaseTaskToTaskData(dbTask: DatabaseTask): TaskData {
    return {
      id: dbTask.id,
      title: dbTask.title,
      description: dbTask.description || undefined,
      type: dbTask.type,
      status: dbTask.status,
      token_estimate: dbTask.token_estimate || undefined,
      project_id: dbTask.project_id,
      created_by: dbTask.created_by,
      position: dbTask.position,
    };
  }
}