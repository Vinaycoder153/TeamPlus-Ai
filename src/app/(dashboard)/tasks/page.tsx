"use client"

import React, { useEffect, useState } from "react"
import { Plus, CheckCircle2, Clock, AlertCircle, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { useAppStore } from "@/store/useAppStore"
import { createClient } from "@/lib/supabase/client"
import { useToast } from "@/components/ui/use-toast"
import { getTaskPointsValue } from "@/lib/scoring"
import type { Task } from "@/types/database"

const STATUS_LABELS: Record<Task["status"], string> = {
  todo: "To Do",
  in_progress: "In Progress",
  review: "Review",
  done: "Done",
}

const PRIORITY_COLORS: Record<Task["priority"], "destructive" | "default" | "secondary" | "outline"> = {
  urgent: "destructive",
  high: "destructive",
  medium: "default",
  low: "secondary",
}

export default function TasksPage() {
  const { user, tasks, setTasks, addTask, updateTask } = useAppStore()
  const [isLoading, setIsLoading] = useState(true)
  const [isCreating, setIsCreating] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<Task["status"]>("todo")
  const { toast } = useToast()

  const [newTask, setNewTask] = useState({
    title: "",
    description: "",
    priority: "medium" as Task["priority"],
    due_date: "",
  })

  useEffect(() => {
    if (!user) return

    const loadTasks = async () => {
      const supabase = createClient()
      const { data } = await supabase
        .from("tasks")
        .select("*")
        .order("created_at", { ascending: false })

      if (data) setTasks(data)
      setIsLoading(false)
    }

    loadTasks()
  }, [user, setTasks])

  const handleCreateTask = async () => {
    if (!user || !newTask.title.trim()) return
    setIsCreating(true)

    const supabase = createClient()
    const pointsValue = getTaskPointsValue(newTask.priority)

    const { data, error } = await supabase
      .from("tasks")
      .insert({
        title: newTask.title.trim(),
        description: newTask.description || null,
        priority: newTask.priority,
        due_date: newTask.due_date || null,
        assigned_to: user.id,
        created_by: user.id,
        team_id: user.team_id,
        points_value: pointsValue,
        status: "todo",
        tags: [],
      })
      .select()
      .single()

    if (error) {
      toast({ title: "Failed to create task", description: error.message, variant: "destructive" })
    } else if (data) {
      addTask(data)
      setNewTask({ title: "", description: "", priority: "medium", due_date: "" })
      setDialogOpen(false)
      toast({ title: "Task created!", description: `"${data.title}" has been added.` })
    }

    setIsCreating(false)
  }

  const handleStatusChange = async (taskId: string, status: Task["status"]) => {
    const supabase = createClient()
    const updates: Partial<Task> = {
      status,
      completed_at: status === "done" ? new Date().toISOString() : null,
    }

    const { error } = await supabase.from("tasks").update(updates).eq("id", taskId)

    if (error) {
      toast({ title: "Failed to update task", variant: "destructive" })
    } else {
      updateTask(taskId, updates)
      if (status === "done") {
        const task = tasks.find((t) => t.id === taskId)
        if (task) {
          toast({
            title: "Task completed! 🎉",
            description: `You earned ${task.points_value} points!`,
          })
          // Notify Slack — fire-and-forget, don't block the UI
          fetch("/api/slack/notify", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              type: "task_completion",
              taskTitle: task.title,
              taskPriority: task.priority,
              pointsEarned: task.points_value,
              completedBy: user?.full_name || user?.email || "A team member",
            }),
          }).catch(() => {
            // Slack notification failures are non-critical
          })
        }
      }
    }
  }

  const filteredTasks = tasks.filter((t) => t.status === activeTab)

  const statusCounts: Record<Task["status"], number> = {
    todo: tasks.filter((t) => t.status === "todo").length,
    in_progress: tasks.filter((t) => t.status === "in_progress").length,
    review: tasks.filter((t) => t.status === "review").length,
    done: tasks.filter((t) => t.status === "done").length,
  }

  const statusIcons: Record<Task["status"], React.ReactNode> = {
    todo: <Clock className="h-4 w-4" />,
    in_progress: <Loader2 className="h-4 w-4" />,
    review: <AlertCircle className="h-4 w-4" />,
    done: <CheckCircle2 className="h-4 w-4 text-green-500" />,
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Tasks</h1>
          <p className="text-muted-foreground">Manage and track your work</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              New Task
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Task</DialogTitle>
              <DialogDescription>Add a new task to your workflow</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="title">Title *</Label>
                <Input
                  id="title"
                  placeholder="Task title..."
                  value={newTask.title}
                  onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  placeholder="Optional description..."
                  value={newTask.description}
                  onChange={(e) => setNewTask({ ...newTask, description: e.target.value })}
                  rows={3}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Priority</Label>
                  <Select
                    value={newTask.priority}
                    onValueChange={(v) => setNewTask({ ...newTask, priority: v as Task["priority"] })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="urgent">Urgent</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="due_date">Due Date</Label>
                  <Input
                    id="due_date"
                    type="date"
                    value={newTask.due_date}
                    onChange={(e) => setNewTask({ ...newTask, due_date: e.target.value })}
                  />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleCreateTask} disabled={isCreating || !newTask.title.trim()}>
                {isCreating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Create Task
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as Task["status"])}>
        <TabsList className="grid w-full grid-cols-4">
          {(Object.keys(STATUS_LABELS) as Task["status"][]).map((status) => (
            <TabsTrigger key={status} value={status} className="gap-1.5">
              {STATUS_LABELS[status]}
              <Badge variant="secondary" className="h-5 min-w-5 px-1 text-xs">
                {statusCounts[status]}
              </Badge>
            </TabsTrigger>
          ))}
        </TabsList>

        {(Object.keys(STATUS_LABELS) as Task["status"][]).map((status) => (
          <TabsContent key={status} value={status} className="mt-4">
            {isLoading ? (
              <div className="text-muted-foreground text-sm">Loading tasks...</div>
            ) : filteredTasks.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center text-muted-foreground">
                  No tasks in {STATUS_LABELS[status].toLowerCase()}
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {filteredTasks.map((task) => {
                  const isOverdue = task.due_date && new Date(task.due_date) < new Date() && task.status !== "done"
                  return (
                    <Card key={task.id}>
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              {statusIcons[task.status]}
                              <p className="font-medium truncate">{task.title}</p>
                            </div>
                            {task.description && (
                              <p className="text-sm text-muted-foreground truncate">{task.description}</p>
                            )}
                            <div className="flex items-center gap-2 mt-2">
                              <Badge variant={PRIORITY_COLORS[task.priority]} className="text-xs">
                                {task.priority}
                              </Badge>
                              {task.due_date && (
                                <span className={`text-xs ${isOverdue ? "text-red-500" : "text-muted-foreground"}`}>
                                  Due: {new Date(task.due_date).toLocaleDateString()}
                                </span>
                              )}
                              <span className="text-xs text-muted-foreground">+{task.points_value} pts</span>
                            </div>
                          </div>
                          <Select
                            value={task.status}
                            onValueChange={(v) => handleStatusChange(task.id, v as Task["status"])}
                          >
                            <SelectTrigger className="w-32 h-8 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="todo">To Do</SelectItem>
                              <SelectItem value="in_progress">In Progress</SelectItem>
                              <SelectItem value="review">Review</SelectItem>
                              <SelectItem value="done">Done</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </CardContent>
                    </Card>
                  )
                })}
              </div>
            )}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  )
}
