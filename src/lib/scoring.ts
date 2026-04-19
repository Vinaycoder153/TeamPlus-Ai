import type { Task, Profile } from "@/types/database"

export interface PerformanceMetrics {
  tasksCompleted: number
  tasksOnTime: number
  completionRate: number
  onTimeRate: number
  overallScore: number
  collaborationScore: number
  qualityScore: number
}

export function calculatePerformanceScore(
  tasks: Task[],
  userId: string
): PerformanceMetrics {
  const userTasks = tasks.filter((t) => t.assigned_to === userId)
  const completedTasks = userTasks.filter((t) => t.status === "done")
  const onTimeTasks = completedTasks.filter((t) => {
    if (!t.due_date || !t.completed_at) return false
    return new Date(t.completed_at) <= new Date(t.due_date)
  })

  const tasksCompleted = completedTasks.length
  const tasksOnTime = onTimeTasks.length
  const completionRate = userTasks.length > 0 ? (tasksCompleted / userTasks.length) * 100 : 0
  const onTimeRate = tasksCompleted > 0 ? (tasksOnTime / tasksCompleted) * 100 : 0

  // Quality score based on priority of completed tasks
  const qualityScore = completedTasks.reduce((acc, task) => {
    const priorityWeights: Record<string, number> = {
      urgent: 4,
      high: 3,
      medium: 2,
      low: 1,
    }
    return acc + (priorityWeights[task.priority] || 1)
  }, 0) / Math.max(completedTasks.length, 1) * 25

  const collaborationScore = Math.min(100, Number(tasksCompleted) * 5 + Number(onTimeTasks) * 3)
  const overallScore = (completionRate * 0.4 + onTimeRate * 0.3 + Math.min(qualityScore, 100) * 0.2 + collaborationScore * 0.1)

  return {
    tasksCompleted,
    tasksOnTime,
    completionRate: Math.round(completionRate),
    onTimeRate: Math.round(onTimeRate),
    overallScore: Math.round(overallScore),
    collaborationScore: Math.round(collaborationScore),
    qualityScore: Math.round(Math.min(qualityScore, 100)),
  }
}

export function rankTeamMembers(
  members: Profile[],
  tasks: Task[]
): Array<Profile & { metrics: PerformanceMetrics; rank: number }> {
  const ranked = members.map((member) => ({
    ...member,
    metrics: calculatePerformanceScore(tasks, member.id),
  }))

  ranked.sort((a, b) => b.points - a.points || b.metrics.overallScore - a.metrics.overallScore)

  return ranked.map((member, index) => ({ ...member, rank: index + 1 }))
}

export function getTaskPointsValue(priority: Task["priority"]): number {
  const pointsMap: Record<Task["priority"], number> = {
    low: 5,
    medium: 10,
    high: 20,
    urgent: 30,
  }
  return pointsMap[priority] ?? 10
}
