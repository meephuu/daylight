import { BrowserRouter, Route, Routes } from "react-router-dom";
import { QueryClientProvider } from "@tanstack/react-query";
import { Layout } from "@/components/Layout";
import { queryClient } from "@/lib/queryClient";
import AppsPage from "@/pages/Apps";
import CalendarPage from "@/pages/Calendar";
import ExpensesPage from "@/pages/Expenses";
import FocusPage from "@/pages/Focus";
import HabitsPage from "@/pages/Habits";
import HomePage from "@/pages/Home";
import MiniPlayer from "@/pages/MiniPlayer";
import MiniTimer from "@/pages/MiniTimer";
import MusicPage from "@/pages/Music";
import NotesPage from "@/pages/Notes";
import ReviewPage from "@/pages/Review";
import SettingsPage from "@/pages/Settings";
import TrainingPage from "@/pages/Training";
import TasksPage from "@/pages/Tasks";

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          {/* The mini timer window: no shell, just the timer. */}
          <Route path="mini" element={<MiniTimer />} />
          {/* The mini player window (Music page): no shell, just the player. */}
          <Route path="mini-player" element={<MiniPlayer />} />
          <Route element={<Layout />}>
            <Route index element={<HomePage />} />
            <Route path="tasks" element={<TasksPage />} />
            <Route path="calendar" element={<CalendarPage />} />
            <Route path="focus" element={<FocusPage />} />
            <Route path="habits" element={<HabitsPage />} />
            <Route path="training" element={<TrainingPage />} />
            <Route path="notes" element={<NotesPage />} />
            <Route path="expenses" element={<ExpensesPage />} />
            <Route path="music" element={<MusicPage />} />
            <Route path="apps" element={<AppsPage />} />
            <Route path="review" element={<ReviewPage />} />
            <Route path="settings" element={<SettingsPage />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
