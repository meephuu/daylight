import { BrowserRouter, Route, Routes } from "react-router-dom";
import { QueryClientProvider } from "@tanstack/react-query";
import { Layout } from "@/components/Layout";
import { queryClient } from "@/lib/queryClient";
import CalendarPage from "@/pages/Calendar";
import ExpensesPage from "@/pages/Expenses";
import HabitsPage from "@/pages/Habits";
import HomePage from "@/pages/Home";
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
          <Route element={<Layout />}>
            <Route index element={<HomePage />} />
            <Route path="tasks" element={<TasksPage />} />
            <Route path="calendar" element={<CalendarPage />} />
            <Route path="habits" element={<HabitsPage />} />
            <Route path="training" element={<TrainingPage />} />
            <Route path="notes" element={<NotesPage />} />
            <Route path="expenses" element={<ExpensesPage />} />
            <Route path="review" element={<ReviewPage />} />
            <Route path="settings" element={<SettingsPage />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
