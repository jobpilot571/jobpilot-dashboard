import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Toaster } from "sonner";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { ForcePasswordChangeModal } from "@/components/auth/ForcePasswordChangeModal";
import RootRedirect from "@/pages/RootRedirect";
import LoginPage from "@/pages/auth/LoginPage";
import ResetPasswordPage from "@/pages/auth/ResetPasswordPage";
import AdminDashboardPage from "@/pages/admin/DashboardPage";
import AdminEmployeesPage from "@/pages/admin/EmployeesPage";
import AdminStudentsPage from "@/pages/admin/StudentsPage";
import AdminStudentProfilePage from "@/pages/admin/StudentProfilePage";
import AdminPlacementPage from "@/pages/admin/PlacementPage";
import AdminFreeTrialsPage from "@/pages/admin/FreeTrialsPage";
import AdminReportsPage from "@/pages/admin/ReportsPage";
import AdminSettingsPage from "@/pages/admin/SettingsPage";
import EmployeeDashboardPage from "@/pages/employee/DashboardPage";
import EmployeeStudentsPage from "@/pages/employee/StudentsPage";
import EmployeeStudentProfilePage from "@/pages/employee/StudentProfilePage";
import EmployeeApplicationsPage from "@/pages/employee/ApplicationsPage";
import EmployeeHistoryPage from "@/pages/employee/HistoryPage";
import EmployeePerformancePage from "@/pages/employee/PerformancePage";
import EmployeeReportsPage from "@/pages/employee/ReportsPage";
import EmployeeProfilePage from "@/pages/employee/ProfilePage";
import StudentDashboardPage from "@/pages/student/DashboardPage";
import StudentProgressPage from "@/pages/student/ProgressPage";
import StudentHistoryPage from "@/pages/student/HistoryPage";
import StudentProfilePage from "@/pages/student/ProfilePage";
import StudentDocumentsPage from "@/pages/student/DocumentsPage";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <ForcePasswordChangeModal />
          <Routes>
            <Route path="/" element={<RootRedirect />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/reset-password" element={<ResetPasswordPage />} />

            <Route path="/admin" element={<ProtectedRoute allowedRole="admin"><AdminDashboardPage /></ProtectedRoute>} />
            <Route path="/admin/employees" element={<ProtectedRoute allowedRole="admin"><AdminEmployeesPage /></ProtectedRoute>} />
            <Route path="/admin/students" element={<ProtectedRoute allowedRole="admin"><AdminStudentsPage /></ProtectedRoute>} />
            <Route path="/admin/students/:id" element={<ProtectedRoute allowedRole="admin"><AdminStudentProfilePage /></ProtectedRoute>} />
            <Route path="/admin/placement" element={<ProtectedRoute allowedRole="admin"><AdminPlacementPage /></ProtectedRoute>} />
            <Route path="/admin/free-trials" element={<ProtectedRoute allowedRole="admin"><AdminFreeTrialsPage /></ProtectedRoute>} />
            <Route path="/admin/reports" element={<ProtectedRoute allowedRole="admin"><AdminReportsPage /></ProtectedRoute>} />
            <Route path="/admin/settings" element={<ProtectedRoute allowedRole="admin"><AdminSettingsPage /></ProtectedRoute>} />

            <Route path="/app" element={<ProtectedRoute allowedRole="employee"><EmployeeDashboardPage /></ProtectedRoute>} />
            <Route path="/app/students" element={<ProtectedRoute allowedRole="employee"><EmployeeStudentsPage /></ProtectedRoute>} />
            <Route path="/app/students/:id" element={<ProtectedRoute allowedRole="employee"><EmployeeStudentProfilePage /></ProtectedRoute>} />
            <Route path="/app/applications" element={<ProtectedRoute allowedRole="employee"><EmployeeApplicationsPage /></ProtectedRoute>} />
            <Route path="/app/history" element={<ProtectedRoute allowedRole="employee"><EmployeeHistoryPage /></ProtectedRoute>} />
            <Route path="/app/performance" element={<ProtectedRoute allowedRole="employee"><EmployeePerformancePage /></ProtectedRoute>} />
            <Route path="/app/reports" element={<ProtectedRoute allowedRole="employee"><EmployeeReportsPage /></ProtectedRoute>} />
            <Route path="/app/profile" element={<ProtectedRoute allowedRole="employee"><EmployeeProfilePage /></ProtectedRoute>} />

            <Route path="/me" element={<ProtectedRoute allowedRole="student"><StudentDashboardPage /></ProtectedRoute>} />
            <Route path="/me/progress" element={<ProtectedRoute allowedRole="student"><StudentProgressPage /></ProtectedRoute>} />
            <Route path="/me/history" element={<ProtectedRoute allowedRole="student"><StudentHistoryPage /></ProtectedRoute>} />
            <Route path="/me/profile" element={<ProtectedRoute allowedRole="student"><StudentProfilePage /></ProtectedRoute>} />
            <Route path="/me/documents" element={<ProtectedRoute allowedRole="student"><StudentDocumentsPage /></ProtectedRoute>} />

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
        <Toaster richColors position="top-right" />
      </AuthProvider>
    </QueryClientProvider>
  );
}
