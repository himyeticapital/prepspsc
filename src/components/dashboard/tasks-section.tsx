"use client";

import { useState } from "react";
import { Plus, Check, Trash2, Circle, ListTodo, Play, Timer } from "lucide-react";
import { useWidgetStore } from "@/stores/widget-store";
import { useTimerStore } from "@/stores/timer-store";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function TasksSection() {
  const { notes, addNote, toggleNote, deleteNote, activeTaskId, setActiveTask, openWidget } = useWidgetStore();
  const { setMode, reset, start, status } = useTimerStore();
  const [newTask, setNewTask] = useState("");

  const handleStartPomodoro = (taskId: string) => {
    setActiveTask(taskId);
    setMode("pomodoro");
    reset();
    start();
    openWidget("timer");
  };

  const handleAddTask = () => {
    if (!newTask.trim()) return;
    addNote(newTask.trim());
    setNewTask("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleAddTask();
    }
  };

  const pendingTasks = notes.filter((n) => !n.completed);
  const completedTasks = notes.filter((n) => n.completed);

  // Show max 5 tasks, prioritizing pending ones
  const displayTasks = [
    ...pendingTasks.slice(0, 5),
    ...completedTasks.slice(0, Math.max(0, 5 - pendingTasks.length)),
  ].slice(0, 5);

  const hasMoreTasks = notes.length > 5;

  return (
    <div className="widget-glass p-5 rounded-2xl h-full">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <ListTodo className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-medium text-white/70">My Tasks</h3>
        </div>
        <span className="text-xs text-white/40">
          {pendingTasks.length} pending
        </span>
      </div>

      {/* Add Task Input */}
      <div className="flex gap-2 mb-4">
        <Input
          value={newTask}
          onChange={(e) => setNewTask(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Add a new task..."
          className="flex-1 h-9 bg-white/5 border-white/10 text-white placeholder:text-white/40 text-sm"
        />
        <Button
          size="sm"
          onClick={handleAddTask}
          disabled={!newTask.trim()}
          className="bg-primary hover:bg-primary/90 h-9 px-3"
        >
          <Plus className="w-4 h-4" />
        </Button>
      </div>

      {/* Tasks List */}
      <div className="space-y-2">
        {displayTasks.length > 0 ? (
          displayTasks.map((task) => (
            <TaskItem
              key={task.id}
              task={task}
              isActive={activeTaskId === task.id}
              isTimerRunning={activeTaskId === task.id && status === "running"}
              onToggle={() => toggleNote(task.id)}
              onDelete={() => deleteNote(task.id)}
              onStartPomodoro={() => handleStartPomodoro(task.id)}
            />
          ))
        ) : (
          <div className="py-6 text-center">
            <p className="text-sm text-white/40">No tasks yet</p>
            <p className="text-xs text-white/30 mt-1">
              Add your first task above
            </p>
          </div>
        )}
      </div>

      {/* Show more indicator */}
      {hasMoreTasks && (
        <p className="text-xs text-white/40 text-center mt-3">
          +{notes.length - 5} more tasks in Notes widget
        </p>
      )}

      {/* Quick Add Buttons */}
      {notes.length < 3 && (
        <div className="mt-4 pt-3 border-t border-white/10">
          <p className="text-xs text-white/30 mb-2">Quick add:</p>
          <div className="flex flex-wrap gap-1">
            {["Study GS", "Practice MCQs", "Revise notes"].map((suggestion) => (
              <button
                key={suggestion}
                onClick={() => addNote(suggestion)}
                className="px-2 py-1 text-xs bg-white/5 hover:bg-white/10 rounded-full text-white/60 transition-colors"
              >
                + {suggestion}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

interface TaskItemProps {
  task: { id: string; text: string; completed: boolean };
  isActive: boolean;
  isTimerRunning: boolean;
  onToggle: () => void;
  onDelete: () => void;
  onStartPomodoro: () => void;
}

function TaskItem({ task, isActive, isTimerRunning, onToggle, onDelete, onStartPomodoro }: TaskItemProps) {
  return (
    <div
      className={cn(
        "flex items-center gap-3 p-2.5 rounded-lg transition-colors group",
        isActive
          ? "bg-primary/20 border border-primary/30"
          : "bg-white/5 hover:bg-white/10"
      )}
    >
      <button
        onClick={onToggle}
        className={cn(
          "w-5 h-5 rounded-full border flex items-center justify-center transition-colors flex-shrink-0",
          task.completed
            ? "bg-primary border-primary"
            : "border-white/30 hover:border-primary"
        )}
      >
        {task.completed ? (
          <Check className="w-3 h-3 text-primary-foreground" />
        ) : (
          <Circle className="w-3 h-3 text-transparent" />
        )}
      </button>
      <span
        className={cn(
          "flex-1 text-sm truncate",
          task.completed ? "text-white/40 line-through" : "text-white"
        )}
      >
        {task.text}
      </span>

      {/* Pomodoro button - only show for incomplete tasks */}
      {!task.completed && (
        <button
          onClick={onStartPomodoro}
          className={cn(
            "p-1.5 rounded transition-all flex-shrink-0",
            isTimerRunning
              ? "bg-primary/30 text-primary animate-pulse"
              : "opacity-0 group-hover:opacity-100 hover:bg-primary/20 text-primary/70 hover:text-primary"
          )}
          title={isTimerRunning ? "Timer running" : "Start Pomodoro"}
        >
          {isTimerRunning ? (
            <Timer className="w-4 h-4" />
          ) : (
            <Play className="w-4 h-4" />
          )}
        </button>
      )}

      <button
        onClick={onDelete}
        className="p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-white/10 text-white/40 hover:text-destructive transition-all flex-shrink-0"
      >
        <Trash2 className="w-4 h-4" />
      </button>
    </div>
  );
}
