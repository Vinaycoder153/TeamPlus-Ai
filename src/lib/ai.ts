import { GoogleGenerativeAI } from "@google/generative-ai"
import type { Task, Profile, PerformanceScore } from "@/types/database"

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY || "")

export interface WeeklyInsightInput {
  team: {
    name: string
    memberCount: number
  }
  metrics: {
    tasksCompleted: number
    tasksInProgress: number
    overdueTasks: number
    avgCompletionRate: number
  }
  topPerformers: Array<{ name: string; score: number }>
  strugglingMembers: Array<{ name: string; score: number }>
}

export interface IndividualInsightInput {
  member: Profile
  recentTasks: Task[]
  performanceHistory: PerformanceScore[]
  currentScore: number
}

export async function generateWeeklyTeamInsight(
  input: WeeklyInsightInput
): Promise<string> {
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" })

  const prompt = `
You are an AI performance coach for a software development team. Analyze the following weekly team data and provide actionable insights.

Team: ${input.team.name} (${input.team.memberCount} members)

Weekly Metrics:
- Tasks Completed: ${input.metrics.tasksCompleted}
- Tasks In Progress: ${input.metrics.tasksInProgress}
- Overdue Tasks: ${input.metrics.overdueTasks}
- Average Completion Rate: ${input.metrics.avgCompletionRate}%

Top Performers:
${input.topPerformers.map((p) => `- ${p.name}: ${p.score} points`).join("\n")}

Members Needing Support:
${input.strugglingMembers.map((m) => `- ${m.name}: ${m.score} points`).join("\n")}

Please provide:
1. A brief summary of team performance this week (2-3 sentences)
2. Key strengths observed
3. Areas for improvement
4. 2-3 specific, actionable recommendations for next week
5. A motivational closing note

Keep the tone professional, encouraging, and constructive. Format as plain text.
`

  try {
    const result = await model.generateContent(prompt)
    const response = await result.response
    return response.text()
  } catch (error) {
    console.error("AI insight generation failed:", error)
    return generateFallbackWeeklyInsight(input)
  }
}

export async function generateIndividualInsight(
  input: IndividualInsightInput
): Promise<string> {
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" })

  const completedTasks = input.recentTasks.filter((t) => t.status === "done").length
  const totalTasks = input.recentTasks.length
  const avgScore =
    input.performanceHistory.length > 0
      ? input.performanceHistory.reduce((sum, s) => sum + s.overall_score, 0) /
        input.performanceHistory.length
      : 0

  const prompt = `
You are an AI performance coach. Provide personalized feedback for a team member.

Member: ${input.member.full_name || input.member.email}
Current Score: ${input.currentScore} points
Recent Tasks: ${completedTasks}/${totalTasks} completed
Historical Average Score: ${Math.round(avgScore)}

Recent Task Details:
${input.recentTasks
  .slice(0, 5)
  .map((t) => `- ${t.title} (${t.status}, ${t.priority} priority)`)
  .join("\n")}

Please provide:
1. A personalized performance summary (2-3 sentences)
2. Specific strengths to acknowledge
3. One key area to focus on for improvement
4. A concrete next step they can take

Keep feedback constructive, specific, and encouraging. Format as plain text.
`

  try {
    const result = await model.generateContent(prompt)
    const response = await result.response
    return response.text()
  } catch (error) {
    console.error("Individual insight generation failed:", error)
    return generateFallbackIndividualInsight(input, completedTasks, totalTasks)
  }
}

function generateFallbackWeeklyInsight(input: WeeklyInsightInput): string {
  const { metrics, team } = input
  const completionRate = metrics.avgCompletionRate

  return `Weekly Summary for ${team.name}:

This week the team completed ${metrics.tasksCompleted} tasks with an average completion rate of ${completionRate}%. ${metrics.overdueTasks > 0 ? `There are ${metrics.overdueTasks} overdue tasks that need attention.` : "Great job keeping tasks on schedule!"}

${input.topPerformers.length > 0 ? `Outstanding work from ${input.topPerformers[0].name} and the team's top contributors.` : ""}

Recommendation: ${completionRate < 70 ? "Focus on breaking down large tasks and removing blockers to improve velocity next week." : "Keep up the great momentum and consider taking on some stretch goals next week."}`
}

function generateFallbackIndividualInsight(
  input: IndividualInsightInput,
  completed: number,
  total: number
): string {
  const rate = total > 0 ? Math.round((completed / total) * 100) : 0
  return `Performance Summary for ${input.member.full_name || input.member.email}:

You completed ${completed} out of ${total} tasks this period (${rate}% completion rate). ${rate >= 80 ? "Excellent work maintaining high productivity!" : "There's opportunity to improve your task completion rate."}

Current score: ${input.currentScore} points. ${input.currentScore >= 100 ? "You're performing above average - keep it up!" : "Focus on completing high-priority tasks to boost your score."}

Next step: ${rate < 70 ? "Try to identify and communicate blockers early to maintain steady progress." : "Consider mentoring teammates to share your successful work habits."}`
}
