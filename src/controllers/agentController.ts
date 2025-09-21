import { Response } from 'express';
import { MongoService } from '../services/mongoService';
import { AuthenticatedRequest } from '../middleware/auth';
import fs from 'fs';
import path from 'path';
import axios from 'axios';
import type {
  AgentData,
  TaskData,
  CreateAgentRequest,
  UpdateAgentRequest,
  AssignAgentRequest,
  RunAgentRequest,
  ApiResponse,
  AvailableAgent,
  AvailableAgentsResponse,
  AgentExecutionResult,
  CoralServerPayload,
} from '../types';

// Create service instance on-demand to avoid initialization timing issues
const getMongoService = () => new MongoService();

export class AgentController {
  static async getAvailableAgents(req: AuthenticatedRequest, res: Response<AvailableAgentsResponse>) {
    try {
      // For now, use mock data from registry.toml
      // TODO: Replace with actual service call to fetch from external server
      const registryPath = path.join(__dirname, '../../registry.toml');

      let availableAgents: AvailableAgent[] = [];

      if (fs.existsSync(registryPath)) {
        // Mock parsing of TOML file - in production this would use a TOML parser
        const content = fs.readFileSync(registryPath, 'utf8');
        const agentPaths = content.match(/path = "([^"]+)"/g) || [];

        availableAgents = agentPaths.map((pathMatch, index) => {
          const path = pathMatch.match(/path = "([^"]+)"/)?.[1] || '';
          const agentName = path.split('/').pop() || `Agent-${index}`;
          return {
            agentId: `coral_${agentName.toLowerCase().replace(/-/g, '_')}`,
            agentName,
            description: `External Coral agent: ${agentName}`,
            type: 'remote' as const,
            capabilities: ['analysis', 'execution', 'debugging'],
          };
        });
      } else {
        // Fallback mock data
        availableAgents = [
          {
            agentId: 'coral_interface_agent',
            agentName: 'Coral-Interface-Agent',
            description: 'Default inference agent for task processing',
            type: 'remote',
            capabilities: ['analysis', 'execution', 'interface'],
          },
          {
            agentId: 'coral_debug_agent',
            agentName: 'Coral-Unified-Debug-Agent',
            description: 'Unified debugging and troubleshooting agent',
            type: 'remote',
            capabilities: ['debugging', 'analysis', 'troubleshooting'],
          },
          {
            agentId: 'coral_buglocator_agent',
            agentName: 'Coral-BugLocator-Agent',
            description: 'Specialized agent for bug detection and location',
            type: 'remote',
            capabilities: ['bug-detection', 'code-analysis', 'debugging'],
          },
        ];
      }

      res.json({
        success: true,
        data: availableAgents,
      });
    } catch (error) {
      console.error('Get Available Agents Error:', error);
      res.status(500).json({
        success: false,
        data: [],
      });
    }
  }

  static async getAgent(req: AuthenticatedRequest, res: Response<ApiResponse<AgentData>>) {
    try {
      // Agent data is already validated and attached by authorization middleware
      if (!req.agent) {
        return res.status(404).json({
          success: false,
          error: 'Agent not found',
        });
      }

      res.json({
        success: true,
        data: req.agent,
      });
    } catch (error) {
      console.error('Get Agent Error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get agent',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  static async getAgentsByOrganization(req: AuthenticatedRequest, res: Response<ApiResponse<AgentData[]>>) {
    try {
      const { organizationId } = req.params;
      const userId = req.user?.id;
      const mongoService = getMongoService();

      if (!userId) {
        return res.status(401).json({
          success: false,
          error: 'User not authenticated',
        });
      }

      // Organization access is already validated by authorization middleware
      const agents = await mongoService.getAgentsByOrganization(organizationId);

      res.json({
        success: true,
        data: agents,
      });
    } catch (error) {
      console.error('Get Agents by Organization Error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get agents',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  static async createAgent(req: AuthenticatedRequest, res: Response<ApiResponse<AgentData>>) {
    try {
      const createData: CreateAgentRequest = req.body;
      const userId = req.user?.id || 'default-user';
      const mongoService = getMongoService();

      // Verify user has access to the organization
      const hasOrgAccess = await mongoService.hasOrganizationAccess(createData.organizationId, userId);
      if (!hasOrgAccess) {
        return res.status(403).json({
          success: false,
          error: 'Access denied: You are not a member of this organization',
        });
      }

      // Check if user has admin or owner role in organization
      const organization = await mongoService.getOrganization(createData.organizationId);
      if (organization) {
        const membership = organization.members.find(member => member.userId === userId);
        if (!membership || !['owner', 'admin'].includes(membership.role)) {
          return res.status(403).json({
            success: false,
            error: 'Access denied: Admin or owner role required to create agents',
          });
        }
      }

      const agentData = {
        ...createData,
        settings: {
          maxTokens: 4000,
          temperature: 0.3,
          autoRun: false,
          retryAttempts: 2,
          timeout: 30,
          ...createData.settings,
        },
        capabilities: createData.capabilities || [],
        createdBy: userId,
        isActive: true,
        isPublic: createData.isPublic || false,
      };

      const newAgent = await mongoService.createAgent(agentData, userId);

      res.status(201).json({
        success: true,
        data: newAgent,
      });
    } catch (error) {
      console.error('Create Agent Error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to create agent',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  static async updateAgent(req: AuthenticatedRequest, res: Response<ApiResponse<AgentData>>) {
    try {
      const { agentId } = req.params;
      const updates: UpdateAgentRequest = req.body;
      const mongoService = getMongoService();

      // Agent access is already validated by authorization middleware
      // Check if user has admin or owner role in organization
      if (!req.organizationMembership || !['owner', 'admin'].includes(req.organizationMembership.role)) {
        return res.status(403).json({
          success: false,
          error: 'Access denied: Admin or owner role required to update agents',
        });
      }

      const updatedAgent = await mongoService.updateAgent(agentId, updates);
      if (!updatedAgent) {
        return res.status(404).json({
          success: false,
          error: 'Agent not found',
        });
      }

      res.json({
        success: true,
        data: updatedAgent,
      });
    } catch (error) {
      console.error('Update Agent Error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to update agent',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  static async deleteAgent(req: AuthenticatedRequest, res: Response<ApiResponse<void>>) {
    try {
      const { agentId } = req.params;
      const mongoService = getMongoService();

      // Agent access is already validated by authorization middleware
      // Check if user has admin or owner role in organization
      if (!req.organizationMembership || !['owner', 'admin'].includes(req.organizationMembership.role)) {
        return res.status(403).json({
          success: false,
          error: 'Access denied: Admin or owner role required to delete agents',
        });
      }

      const deleted = await mongoService.deleteAgent(agentId);
      if (!deleted) {
        return res.status(404).json({
          success: false,
          error: 'Agent not found',
        });
      }

      res.json({
        success: true,
        message: 'Agent deleted successfully',
      });
    } catch (error) {
      console.error('Delete Agent Error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to delete agent',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  static async assignAgentsToTask(req: AuthenticatedRequest, res: Response<ApiResponse<TaskData>>) {
    try {
      const { taskId } = req.params;
      const { agents, autoRun }: AssignAgentRequest = req.body;
      const userId = req.user?.id || 'default-user';
      const mongoService = getMongoService();

      // Get task data
      const task = await mongoService.getTask(taskId);
      if (!task) {
        return res.status(404).json({
          success: false,
          error: 'Task not found',
        });
      }

      // Check if user has access to the task through project membership
      const project = await mongoService.getProject(task.projectId);
      if (!project) {
        return res.status(404).json({
          success: false,
          error: 'Project not found',
        });
      }

      const hasProjectAccess = await mongoService.hasProjectAccess(task.projectId, userId);
      if (!hasProjectAccess) {
        return res.status(403).json({
          success: false,
          error: 'Access denied: You do not have access to this project',
        });
      }

      // Add to agent history for each assigned agent
      const newAgentHistoryEntries = agents.map(agent => ({
        agentId: agent.agentId,
        assignedAt: new Date(),
        assignedBy: userId,
      }));

      const updatedAgentHistory = [...task.agentHistory, ...newAgentHistoryEntries];

      // Update task with assigned agents
      const updatedTask = await mongoService.updateTask(taskId, {
        agents: agents,
        agentHistory: updatedAgentHistory,
      });

      if (!updatedTask) {
        return res.status(500).json({
          success: false,
          error: 'Failed to assign agents to task',
        });
      }

      // Auto-run if requested
      if (autoRun && agents.length > 0) {
        // Use first agent as default or a specific logic
        const primaryAgent = agents[0];
        console.log(`Auto-running agent ${primaryAgent.agentName} (${primaryAgent.agentId}) for task ${taskId}`);
      }

      res.json({
        success: true,
        data: updatedTask,
      });
    } catch (error) {
      console.error('Assign Agents Error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to assign agents',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  static async runAgent(req: AuthenticatedRequest, res: Response<ApiResponse<TaskData & { executionResult?: AgentExecutionResult }>>) {
    try {
      const { taskId } = req.params;
      const { agentId, options }: RunAgentRequest = req.body;
      const userId = req.user?.id || 'default-user';
      const mongoService = getMongoService();

      // Get task data
      const task = await mongoService.getTask(taskId);
      if (!task) {
        return res.status(404).json({
          success: false,
          error: 'Task not found',
        });
      }

      // Check if user has access to the task through project membership
      const hasProjectAccess = await mongoService.hasProjectAccess(task.projectId, userId);
      if (!hasProjectAccess) {
        return res.status(403).json({
          success: false,
          error: 'Access denied: You do not have access to this project',
        });
      }

      // Determine which agent to run
      let targetAgentId = agentId;
      let targetAgentName = '';

      if (!targetAgentId) {
        // Use assigned agents or default to inference agent
        if (task.agents && task.agents.length > 0) {
          targetAgentId = task.agents[0].agentId;
          targetAgentName = task.agents[0].agentName;
        } else {
          // Default to Coral Interface Agent (inference)
          targetAgentId = 'coral_interface_agent';
          targetAgentName = 'Coral-Interface-Agent';
        }
      } else {
        // Find agent name from task's assigned agents
        const assignedAgent = task.agents?.find(agent => agent.agentId === targetAgentId);
        targetAgentName = assignedAgent?.agentName || 'Unknown Agent';
      }

      // Prepare context for the agent
      const project = await mongoService.getProject(task.projectId);
      const taskContext = {
        taskId: task._id,
        taskTitle: task.title,
        taskDescription: task.description,
        taskType: task.type,
        taskPriority: task.priority,
        taskStatus: task.status,
        projectContext: {
          projectId: project?._id,
          projectName: project?.name,
          projectDescription: project?.description,
        },
      };

      // Create query for the coral server
      const query = `Task: ${task.title}${task.description ? `\nDescription: ${task.description}` : ''}`;

      let executionResult: AgentExecutionResult;

      try {
        // Call the external microservice (Coral Server)
        const coralServerPayload: CoralServerPayload = {
          query,
          context: taskContext,
        };

        // TODO: Replace with actual coral server integration
        // const coralServerUrl = process.env.CORAL_SERVER_URL || 'http://localhost:8000';
        // For now, simulate the API call
        console.log(`Executing agent ${targetAgentName} (${targetAgentId}) for task ${taskId}`);
        console.log('Payload:', JSON.stringify(coralServerPayload, null, 2));

        // Mock API call to coral server
        const mockApiResponse = await AgentController.simulateCoralServerCall(coralServerPayload, targetAgentId);

        executionResult = mockApiResponse;

      } catch (apiError) {
        console.error('Coral Server API Error:', apiError);
        executionResult = {
          success: false,
          error: `Failed to execute agent: ${apiError instanceof Error ? apiError.message : 'Unknown error'}`,
          tokensUsed: 0,
          executionTime: 0,
          status: 'failed',
        };
      }

      // Update agent history with result
      const newHistoryEntry = {
        agentId: targetAgentId,
        assignedAt: new Date(),
        assignedBy: userId,
        result: {
          success: executionResult.success,
          output: executionResult.output,
          tokensUsed: executionResult.tokensUsed,
          executedAt: new Date(),
          error: executionResult.error,
        },
      };

      const updatedAgentHistory = [...task.agentHistory, newHistoryEntry];

      // Determine task status and progress based on execution result
      let newStatus = task.status;
      let newProgressPercentage = task.progressPercentage;

      if (executionResult.success) {
        if (executionResult.status === 'completed') {
          newStatus = 'done';
          newProgressPercentage = 100;
        } else if (executionResult.status === 'in_progress') {
          newStatus = 'in_progress';
          newProgressPercentage = Math.min(task.progressPercentage + 25, 95);
        }
      }

      // Update task with execution results
      const updatedTask = await mongoService.updateTask(taskId, {
        agentHistory: updatedAgentHistory,
        actualTokensUsed: task.actualTokensUsed + executionResult.tokensUsed,
        lastAgentRun: new Date(),
        progressPercentage: newProgressPercentage,
        status: newStatus,
      });

      if (!updatedTask) {
        return res.status(500).json({
          success: false,
          error: 'Failed to update task after agent run',
        });
      }

      res.json({
        success: true,
        data: {
          ...updatedTask,
          executionResult,
        },
      });
    } catch (error) {
      console.error('Run Agent Error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to run agent',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  // Mock method to simulate coral server API call
  private static async simulateCoralServerCall(payload: CoralServerPayload, agentId: string): Promise<AgentExecutionResult> {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 2000));

    // Agent-specific responses based on agentId
    const agentResponses = this.getAgentSpecificResponse(agentId, payload);

    // Random success rate (90% success)
    const isSuccess = Math.random() > 0.1;

    if (!isSuccess) {
      return {
        success: false,
        status: 'failed',
        error: `Agent ${agentId} encountered an unexpected error during execution`,
        tokensUsed: Math.floor(Math.random() * 200) + 100,
        executionTime: Math.floor(Math.random() * 10000) + 2000,
      };
    }

    const isComplete = Math.random() > 0.3; // 70% chance of completion

    return {
      success: true,
      status: isComplete ? 'completed' : 'in_progress',
      output: agentResponses.output,
      followUp: agentResponses.followUp,
      artifacts: agentResponses.artifacts,
      tokensUsed: Math.floor(Math.random() * 1000) + 200,
      executionTime: Math.floor(Math.random() * 30000) + 5000,
    };
  }

  // Generate agent-specific mock responses
  private static getAgentSpecificResponse(agentId: string, payload: CoralServerPayload) {
    const taskTitle = payload.context?.taskTitle || 'Task';

    switch (agentId) {
      case 'coral_coral_unified_debug_agent':
      case 'coral_unified_debug_agent':
        return {
          output: `🔍 Debug Analysis Complete for "${taskTitle}"\n\nFound 3 potential issues in the codebase:\n• Memory leak in user session handling\n• Race condition in data processing pipeline\n• Missing error boundary in React components\n\nGenerated patch file with fixes for critical issues.`,
          followUp: {
            suggestions: [
              'Review the generated patch before applying',
              'Run tests after applying fixes',
              'Monitor memory usage in production',
              'Add integration tests for race conditions'
            ],
            nextActions: [
              'Apply the patch to fix critical issues',
              'Schedule code review for the changes',
              'Update monitoring alerts'
            ]
          },
          artifacts: [{
            type: 'git_patch' as const,
            title: 'Debug Fixes - Critical Issues Resolution',
            content: `diff --git a/src/components/UserSession.js b/src/components/UserSession.js
index 1234567..abcdefg 100644
--- a/src/components/UserSession.js
+++ b/src/components/UserSession.js
@@ -15,8 +15,12 @@ class UserSession {
   constructor(userId) {
     this.userId = userId;
     this.listeners = new Set();
+    this.cleanup = this.cleanup.bind(this);
   }

+  cleanup() {
+    this.listeners.clear();
+  }
+
   addListener(callback) {
     this.listeners.add(callback);
@@ -32,6 +36,9 @@ class UserSession {

   destroy() {
     this.listeners.clear();
+    if (this.cleanupTimer) {
+      clearTimeout(this.cleanupTimer);
+    }
   }
 }

diff --git a/src/utils/DataProcessor.js b/src/utils/DataProcessor.js
index 2345678..bcdefgh 100644
--- a/src/utils/DataProcessor.js
+++ b/src/utils/DataProcessor.js
@@ -45,6 +45,7 @@ class DataProcessor {
   async processData(data) {
     if (this.isProcessing) {
       console.warn('Processing already in progress');
+      await this.waitForCompletion();
       return;
     }

@@ -58,6 +59,15 @@ class DataProcessor {
     } finally {
       this.isProcessing = false;
     }
+  }
+
+  async waitForCompletion() {
+    return new Promise((resolve) => {
+      const check = () => {
+        if (!this.isProcessing) resolve();
+        else setTimeout(check, 100);
+      };
+      check();
+    });
   }

diff --git a/src/components/ErrorBoundary.jsx b/src/components/ErrorBoundary.jsx
new file mode 100644
index 0000000..1234567
--- /dev/null
+++ b/src/components/ErrorBoundary.jsx
@@ -0,0 +1,35 @@
+import React from 'react';
+
+class ErrorBoundary extends React.Component {
+  constructor(props) {
+    super(props);
+    this.state = { hasError: false, error: null };
+  }
+
+  static getDerivedStateFromError(error) {
+    return { hasError: true, error };
+  }
+
+  componentDidCatch(error, errorInfo) {
+    console.error('Error boundary caught error:', error, errorInfo);
+    // Log to monitoring service
+    if (window.errorReporting) {
+      window.errorReporting.captureException(error, errorInfo);
+    }
+  }
+
+  render() {
+    if (this.state.hasError) {
+      return (
+        <div className="error-boundary">
+          <h2>Something went wrong</h2>
+          <p>We apologize for the inconvenience. Please try refreshing the page.</p>
+          <button onClick={() => window.location.reload()}>
+            Refresh Page
+          </button>
+        </div>
+      );
+    }
+
+    return this.props.children;
+  }
+}`,
            metadata: {
              repository: 'https://github.com/schumbar/agent-test-repo',
              branch: 'debug-fixes',
              filesChanged: 3,
              linesAdded: 47,
              linesRemoved: 2,
              language: 'javascript'
            }
          }]
        };

      case 'coral_coral_interface_agent':
      case 'coral_interface_agent':
        return {
          output: `✅ Interface Analysis Complete for "${taskTitle}"\n\nAnalyzed user interface requirements and generated comprehensive recommendations:\n• Improved accessibility features\n• Enhanced mobile responsiveness\n• Streamlined user workflows\n• Performance optimizations\n\nReady for implementation review.`,
          followUp: {
            suggestions: [
              'Review UI/UX recommendations',
              'Validate accessibility improvements',
              'Test mobile responsive design',
              'Consider user feedback integration'
            ],
            nextActions: [
              'Implement recommended UI changes',
              'Conduct usability testing',
              'Update design system documentation'
            ]
          },
          artifacts: [{
            type: 'analysis' as const,
            title: 'UI/UX Analysis Report',
            content: `# Interface Analysis Report

## Executive Summary
Comprehensive analysis of user interface for "${taskTitle}" reveals several optimization opportunities.

## Key Findings
### Accessibility Issues
- Missing aria-labels on 12 interactive elements
- Color contrast ratio below WCAG standards in 5 components
- Keyboard navigation gaps in modal dialogs

### Performance Bottlenecks
- Large bundle size due to unused dependencies (3.2MB)
- Inefficient re-renders in data tables
- Missing image optimization

### Mobile Experience
- Touch targets smaller than 44px in navigation
- Horizontal scrolling on screens < 768px
- Font sizes not optimized for mobile reading

## Recommendations
1. Implement semantic HTML structure
2. Add proper ARIA attributes
3. Optimize bundle splitting
4. Implement virtual scrolling for large lists
5. Redesign mobile navigation pattern

## Implementation Priority
High: Accessibility fixes (WCAG compliance)
Medium: Performance optimizations
Low: Mobile UX enhancements`
          }]
        };

      case 'coral_coral_buglocator_agent':
      case 'coral_buglocator_agent':
        return {
          output: `🐛 Bug Analysis Complete for "${taskTitle}"\n\nIdentified 5 potential bugs in the codebase:\n• Critical: Null pointer exception in payment processing\n• High: Memory leak in event listeners\n• Medium: Race condition in state updates\n• Low: Inconsistent error handling\n• Low: Missing input validation\n\nGenerated detailed bug report with reproduction steps.`,
          followUp: {
            suggestions: [
              'Prioritize critical and high severity bugs',
              'Add unit tests for identified edge cases',
              'Implement error monitoring',
              'Review code patterns that led to bugs'
            ],
            nextActions: [
              'Fix critical payment processing bug immediately',
              'Schedule team review of bug patterns',
              'Update coding standards documentation'
            ]
          },
          artifacts: [{
            type: 'test_results' as const,
            title: 'Bug Analysis Report',
            content: `# Bug Analysis Report - ${taskTitle}

## Critical Issues (Fix Immediately)

### BUG-001: Null Pointer Exception in Payment Processing
**Severity:** Critical
**Location:** src/payments/PaymentProcessor.js:45
**Description:** Attempting to access properties on undefined user object
**Reproduction:**
1. User without saved payment methods
2. Attempts to make purchase
3. Application crashes with null pointer exception

**Fix:** Add null checks before property access
\`\`\`javascript
if (user && user.paymentMethods) {
  // Process payment
}
\`\`\`

## High Priority Issues

### BUG-002: Memory Leak in Event Listeners
**Severity:** High
**Location:** src/components/DataTable.jsx:23
**Description:** Event listeners not properly removed on component unmount
**Impact:** Memory usage increases over time
**Fix:** Use cleanup function in useEffect

## Medium Priority Issues

### BUG-003: Race Condition in State Updates
**Severity:** Medium
**Location:** src/hooks/useDataFetch.js:15
**Description:** Concurrent API calls can cause inconsistent state
**Fix:** Implement proper request cancellation

## Test Coverage Analysis
- Current coverage: 68%
- Recommended coverage: 85%
- Missing tests for error scenarios: 23 cases
- Missing integration tests: 8 workflows

## Recommended Actions
1. Implement comprehensive error boundaries
2. Add automated testing for edge cases
3. Set up error monitoring with Sentry
4. Code review checklist for common patterns`
          }]
        };

      case 'coral_coral_economics_agent':
      case 'coral_economics_agent':
        return {
          output: `💰 Economics Analysis Complete for "${taskTitle}"\n\nGenerated comprehensive cost-benefit analysis:\n• Implementation cost: $12,500\n• Expected ROI: 285% over 12 months\n• Resource requirements: 2 developers, 3 weeks\n• Risk factors: Medium complexity, Low technical risk\n\nDetailed financial projections and resource allocation plan generated.`,
          followUp: {
            suggestions: [
              'Review budget allocation with stakeholders',
              'Validate ROI assumptions with market data',
              'Consider phased implementation approach',
              'Plan resource scheduling with team leads'
            ],
            nextActions: [
              'Present economics report to leadership',
              'Secure budget approval',
              'Begin resource allocation planning'
            ]
          },
          artifacts: [{
            type: 'analysis' as const,
            title: 'Economic Impact Analysis',
            content: `# Economic Impact Analysis - ${taskTitle}

## Executive Summary
Implementation of "${taskTitle}" shows strong positive ROI with manageable risk profile.

## Cost Analysis
### Development Costs
- Senior Developer (160 hours): $8,000
- Junior Developer (120 hours): $3,600
- Code Review & QA (20 hours): $900
**Total Development: $12,500**

### Operational Costs (Annual)
- Infrastructure: $2,400/year
- Maintenance: $1,800/year
- Support: $1,200/year
**Total Operational: $5,400/year**

## Revenue Impact
### Direct Benefits
- Increased efficiency: $18,000/year
- Reduced manual work: $24,000/year
- Error reduction savings: $8,500/year

### Indirect Benefits
- Customer satisfaction improvement
- Team productivity increase
- Scalability for future growth

## ROI Calculation
- Year 1 Net Benefit: $35,700
- Investment: $12,500
- **ROI: 285%**

## Risk Assessment
- Technical Risk: Low (proven technologies)
- Market Risk: Medium (feature adoption)
- Resource Risk: Low (team availability confirmed)

## Timeline & Milestones
- Week 1-2: Core development
- Week 3: Testing & refinement
- Week 4: Deployment & monitoring

## Recommendation
**PROCEED** - Strong business case with excellent ROI potential.`
          }]
        };

      default:
        // Generic response for other agents
        const agentName = agentId.replace('coral_', '').replace(/_/g, '-');
        return {
          output: `✅ ${agentName} Analysis Complete for "${taskTitle}"\n\nSuccessfully processed the task requirements and generated actionable insights. The analysis covers key areas relevant to the task scope with specific recommendations for implementation.\n\nAll deliverables have been generated and are ready for review.`,
          followUp: {
            suggestions: [
              'Review generated analysis and recommendations',
              'Validate findings with domain experts',
              'Plan implementation timeline',
              'Consider integration with existing workflows'
            ],
            nextActions: [
              'Implement recommended changes',
              'Schedule team review of outputs',
              'Begin next phase of development'
            ]
          },
          artifacts: [{
            type: 'analysis' as const,
            title: `${agentName} Analysis Report`,
            content: `# ${agentName} Analysis Report - ${taskTitle}

## Overview
This report contains the analysis and recommendations generated by the ${agentName} agent for the specified task.

## Key Findings
- Comprehensive analysis completed successfully
- Multiple optimization opportunities identified
- Implementation roadmap generated
- Risk assessment completed

## Deliverables
- Detailed analysis report
- Implementation recommendations
- Resource requirements
- Timeline estimates

## Next Steps
1. Review findings with stakeholders
2. Prioritize recommendations
3. Begin implementation planning
4. Set up progress monitoring

Generated by ${agentName} v1.0`
          }]
        };
    }
  }
}