import type { Profile } from "@/types/database"

export interface Badge {
  id: string
  name: string
  description: string
  icon: string
  requirement: number
  type: "tasks" | "streak" | "points" | "level"
}

export const BADGES: Badge[] = [
  {
    id: "first_task",
    name: "First Steps",
    description: "Complete your first task",
    icon: "🎯",
    requirement: 1,
    type: "tasks",
  },
  {
    id: "task_master_10",
    name: "Task Master",
    description: "Complete 10 tasks",
    icon: "⚡",
    requirement: 10,
    type: "tasks",
  },
  {
    id: "task_master_50",
    name: "Productivity Pro",
    description: "Complete 50 tasks",
    icon: "🚀",
    requirement: 50,
    type: "tasks",
  },
  {
    id: "century",
    name: "Century Club",
    description: "Complete 100 tasks",
    icon: "💯",
    requirement: 100,
    type: "tasks",
  },
  {
    id: "level_5",
    name: "Rising Star",
    description: "Reach level 5",
    icon: "⭐",
    requirement: 5,
    type: "level",
  },
  {
    id: "level_10",
    name: "Team Champion",
    description: "Reach level 10",
    icon: "🏆",
    requirement: 10,
    type: "level",
  },
  {
    id: "points_500",
    name: "Point Collector",
    description: "Earn 500 points",
    icon: "💎",
    requirement: 500,
    type: "points",
  },
  {
    id: "points_1000",
    name: "Elite Performer",
    description: "Earn 1000 points",
    icon: "👑",
    requirement: 1000,
    type: "points",
  },
]

export const LEVEL_THRESHOLDS = [
  0, 100, 250, 500, 1000, 1750, 2750, 4000, 5500, 7500, 10000,
]

export function calculateLevel(points: number): number {
  let level = 1
  for (let i = 0; i < LEVEL_THRESHOLDS.length; i++) {
    if (points >= LEVEL_THRESHOLDS[i]) {
      level = i + 1
    } else {
      break
    }
  }
  return level
}

export function getPointsToNextLevel(points: number): { current: number; next: number; progress: number } {
  const currentLevel = calculateLevel(points)
  const currentThreshold = LEVEL_THRESHOLDS[currentLevel - 1] || 0
  const nextThreshold = LEVEL_THRESHOLDS[currentLevel] || LEVEL_THRESHOLDS[LEVEL_THRESHOLDS.length - 1]
  const progress = Math.round(((points - currentThreshold) / (nextThreshold - currentThreshold)) * 100)

  return {
    current: points - currentThreshold,
    next: nextThreshold - currentThreshold,
    progress: Math.min(progress, 100),
  }
}

export function checkNewBadges(
  profile: Profile,
  tasksCompleted: number
): string[] {
  const newBadges: string[] = []
  const currentBadges = profile.badges || []

  for (const badge of BADGES) {
    if (currentBadges.includes(badge.id)) continue

    let earned = false
    if (badge.type === "tasks" && tasksCompleted >= badge.requirement) earned = true
    if (badge.type === "points" && profile.points >= badge.requirement) earned = true
    if (badge.type === "level" && profile.level >= badge.requirement) earned = true

    if (earned) newBadges.push(badge.id)
  }

  return newBadges
}

export function getBadgeById(id: string): Badge | undefined {
  return BADGES.find((b) => b.id === id)
}

export function getLevelTitle(level: number): string {
  const titles: Record<number, string> = {
    1: "Newcomer",
    2: "Contributor",
    3: "Performer",
    4: "Achiever",
    5: "Rising Star",
    6: "Expert",
    7: "Leader",
    8: "Master",
    9: "Legend",
    10: "Elite",
  }
  return titles[level] || `Level ${level}`
}
