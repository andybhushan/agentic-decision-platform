import { useState, useEffect } from 'react';
import {
  Tile,
  Tag,
  ProgressBar,
} from '@carbon/react';
import { Checkmark, InProgress, Pending } from '@carbon/icons-react';
import './LiveAgentActivity.scss';

interface AgentTask {
  id: string;
  description: string;
  status: 'pending' | 'in_progress' | 'complete';
  agent: string;
  progress?: number;
}

interface LiveAgentActivityProps {
  actionType: string;
  isExecuting: boolean;
  onComplete?: () => void;
}

export const LiveAgentActivity: React.FC<LiveAgentActivityProps> = ({
  isExecuting,
  onComplete,
}) => {
  const [tasks, setTasks] = useState<AgentTask[]>([
    {
      id: 'policy-check',
      description: 'Policy guardrail check',
      status: 'pending',
      agent: 'Policy DW',
      progress: 0,
    },
    {
      id: 'resource-calls',
      description: 'Calling Damage DW and AI Steward with selected evidence context',
      status: 'pending',
      agent: 'Orchestrator',
      progress: 0,
    },
    {
      id: 'claim-update',
      description: 'Preparing claim file changes, agent plan revision, and confidence recalculation',
      status: 'pending',
      agent: 'Claim Manager',
      progress: 0,
    },
    {
      id: 'audit-draft',
      description: 'Drafting decision rationale and claimant-facing update before finalizing',
      status: 'pending',
      agent: 'Communication DW',
      progress: 0,
    },
    {
      id: 'next-decision',
      description: 'Re-scoring open decisions across the portfolio after this steering change',
      status: 'pending',
      agent: 'Decision Engine',
      progress: 0,
    },
  ]);

  const [currentTaskIndex, setCurrentTaskIndex] = useState(0);

  useEffect(() => {
    if (!isExecuting) return;

    const executeNextTask = () => {
      if (currentTaskIndex >= tasks.length) {
        if (onComplete) {
          setTimeout(onComplete, 500);
        }
        return;
      }

      // Mark current task as in progress
      setTasks(prev => prev.map((task, idx) => 
        idx === currentTaskIndex 
          ? { ...task, status: 'in_progress' as const, progress: 0 }
          : task
      ));

      // Simulate progress
      const progressInterval = setInterval(() => {
        setTasks(prev => prev.map((task, idx) => {
          if (idx === currentTaskIndex && task.status === 'in_progress') {
            const newProgress = Math.min((task.progress || 0) + 20, 100);
            return { ...task, progress: newProgress };
          }
          return task;
        }));
      }, 300);

      // Complete task after duration
      const duration = 1500 + Math.random() * 1000;
      setTimeout(() => {
        clearInterval(progressInterval);
        setTasks(prev => prev.map((task, idx) => 
          idx === currentTaskIndex 
            ? { ...task, status: 'complete' as const, progress: 100 }
            : task
        ));
        setCurrentTaskIndex(prev => prev + 1);
      }, duration);
    };

    executeNextTask();
  }, [currentTaskIndex, isExecuting, tasks.length, onComplete]);

  const getStatusIcon = (status: AgentTask['status']) => {
    switch (status) {
      case 'complete':
        return <Checkmark size={16} />;
      case 'in_progress':
        return <InProgress size={16} />;
      default:
        return <Pending size={16} />;
    }
  };

  const getStatusTag = (status: AgentTask['status']) => {
    switch (status) {
      case 'complete':
        return <Tag type="green" size="sm">Complete</Tag>;
      case 'in_progress':
        return <Tag type="blue" size="sm">In Progress</Tag>;
      default:
        return <Tag type="gray" size="sm">Pending</Tag>;
    }
  };

  if (!isExecuting) return null;

  return (
    <Tile className="live-agent-activity">
      <div className="live-agent-activity__header">
        <h4>APPLYING CLAIM ADJUSTMENT</h4>
        <Tag type="purple" size="sm">Live Execution</Tag>
      </div>

      <div className="live-agent-activity__tasks">
        {tasks.map((task) => (
          <div 
            key={task.id} 
            className={`live-agent-activity__task live-agent-activity__task--${task.status}`}
          >
            <div className="live-agent-activity__task-header">
              <div className="live-agent-activity__task-icon">
                {getStatusIcon(task.status)}
              </div>
              <div className="live-agent-activity__task-info">
                <p className="live-agent-activity__task-description">{task.description}</p>
                <div className="live-agent-activity__task-meta">
                  <Tag type="outline" size="sm">{task.agent}</Tag>
                  {getStatusTag(task.status)}
                </div>
              </div>
            </div>
            {task.status === 'in_progress' && task.progress !== undefined && (
              <ProgressBar
                value={task.progress}
                max={100}
                label=""
                hideLabel
                size="small"
              />
            )}
          </div>
        ))}
      </div>

      <div className="live-agent-activity__footer">
        <p className="live-agent-activity__status">
          {currentTaskIndex < tasks.length 
            ? `Processing step ${currentTaskIndex + 1} of ${tasks.length}...`
            : 'All tasks complete'}
        </p>
      </div>
    </Tile>
  );
};

// Made with Bob
