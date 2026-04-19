import { create } from "zustand"
import type { Profile, Task, Team, AiInsight } from "@/types/database"

interface AppState {
  // Auth
  user: Profile | null
  setUser: (user: Profile | null) => void

  // Team
  team: Team | null
  setTeam: (team: Team | null) => void
  teamMembers: Profile[]
  setTeamMembers: (members: Profile[]) => void

  // Tasks
  tasks: Task[]
  setTasks: (tasks: Task[]) => void
  addTask: (task: Task) => void
  updateTask: (id: string, updates: Partial<Task>) => void
  removeTask: (id: string) => void

  // AI Insights
  insights: AiInsight[]
  setInsights: (insights: AiInsight[]) => void

  // UI State
  isSidebarOpen: boolean
  setSidebarOpen: (open: boolean) => void
  isLoading: boolean
  setLoading: (loading: boolean) => void
}

export const useAppStore = create<AppState>((set) => ({
  // Auth
  user: null,
  setUser: (user) => set({ user }),

  // Team
  team: null,
  setTeam: (team) => set({ team }),
  teamMembers: [],
  setTeamMembers: (teamMembers) => set({ teamMembers }),

  // Tasks
  tasks: [],
  setTasks: (tasks) => set({ tasks }),
  addTask: (task) => set((state) => ({ tasks: [...state.tasks, task] })),
  updateTask: (id, updates) =>
    set((state) => ({
      tasks: state.tasks.map((t) => (t.id === id ? { ...t, ...updates } : t)),
    })),
  removeTask: (id) =>
    set((state) => ({ tasks: state.tasks.filter((t) => t.id !== id) })),

  // AI Insights
  insights: [],
  setInsights: (insights) => set({ insights }),

  // UI State
  isSidebarOpen: true,
  setSidebarOpen: (isSidebarOpen) => set({ isSidebarOpen }),
  isLoading: false,
  setLoading: (isLoading) => set({ isLoading }),
}))
