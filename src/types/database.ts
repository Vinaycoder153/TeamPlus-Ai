export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          email: string
          full_name: string | null
          avatar_url: string | null
          role: "admin" | "manager" | "member"
          department: string | null
          team_id: string | null
          points: number
          level: number
          badges: string[]
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          email: string
          full_name?: string | null
          avatar_url?: string | null
          role?: "admin" | "manager" | "member"
          department?: string | null
          team_id?: string | null
          points?: number
          level?: number
          badges?: string[]
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string
          full_name?: string | null
          avatar_url?: string | null
          role?: "admin" | "manager" | "member"
          department?: string | null
          team_id?: string | null
          points?: number
          level?: number
          badges?: string[]
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      teams: {
        Row: {
          id: string
          name: string
          description: string | null
          manager_id: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          description?: string | null
          manager_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          description?: string | null
          manager_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      tasks: {
        Row: {
          id: string
          title: string
          description: string | null
          status: "todo" | "in_progress" | "review" | "done"
          priority: "low" | "medium" | "high" | "urgent"
          assigned_to: string | null
          created_by: string
          team_id: string | null
          due_date: string | null
          completed_at: string | null
          points_value: number
          tags: string[]
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          title: string
          description?: string | null
          status?: "todo" | "in_progress" | "review" | "done"
          priority?: "low" | "medium" | "high" | "urgent"
          assigned_to?: string | null
          created_by: string
          team_id?: string | null
          due_date?: string | null
          completed_at?: string | null
          points_value?: number
          tags?: string[]
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          title?: string
          description?: string | null
          status?: "todo" | "in_progress" | "review" | "done"
          priority?: "low" | "medium" | "high" | "urgent"
          assigned_to?: string | null
          created_by?: string
          team_id?: string | null
          due_date?: string | null
          completed_at?: string | null
          points_value?: number
          tags?: string[]
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      performance_scores: {
        Row: {
          id: string
          user_id: string
          week_start: string
          tasks_completed: number
          tasks_on_time: number
          collaboration_score: number
          quality_score: number
          overall_score: number
          ai_insights: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          week_start: string
          tasks_completed?: number
          tasks_on_time?: number
          collaboration_score?: number
          quality_score?: number
          overall_score?: number
          ai_insights?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          week_start?: string
          tasks_completed?: number
          tasks_on_time?: number
          collaboration_score?: number
          quality_score?: number
          overall_score?: number
          ai_insights?: string | null
          created_at?: string
        }
        Relationships: []
      }
      ai_insights: {
        Row: {
          id: string
          team_id: string | null
          user_id: string | null
          insight_type: "weekly_summary" | "individual_feedback" | "team_health" | "risk_alert"
          content: string
          metadata: Json | null
          created_at: string
        }
        Insert: {
          id?: string
          team_id?: string | null
          user_id?: string | null
          insight_type: "weekly_summary" | "individual_feedback" | "team_health" | "risk_alert"
          content: string
          metadata?: Json | null
          created_at?: string
        }
        Update: {
          id?: string
          team_id?: string | null
          user_id?: string | null
          insight_type?: "weekly_summary" | "individual_feedback" | "team_health" | "risk_alert"
          content?: string
          metadata?: Json | null
          created_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: {
        Row: Record<string, unknown>
        Insert: Record<string, unknown>
        Update: Record<string, unknown>
        Relationships: never[]
      }
    }
    Functions: {
      [_ in never]: {
        Args: Record<string, unknown>
        Returns: unknown
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

export type Profile = Database["public"]["Tables"]["profiles"]["Row"]
export type Team = Database["public"]["Tables"]["teams"]["Row"]
export type Task = Database["public"]["Tables"]["tasks"]["Row"]
export type PerformanceScore = Database["public"]["Tables"]["performance_scores"]["Row"]
export type AiInsight = Database["public"]["Tables"]["ai_insights"]["Row"]
