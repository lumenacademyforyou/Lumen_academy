import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import DashboardPage from '../pages/dashboard/DashboardPage';
import SchoolsPage from '../pages/schools/SchoolsPage';
import SchoolAdminsPage from '../pages/school-admins/SchoolAdminsPage';
import StudentsPage from '../pages/students/StudentsPage';
import BatchesPage from '../pages/batches/BatchesPage';
import CoursesPage from '../pages/courses/CoursesPage';
import QuestionBankPage from '../pages/question-bank/QuestionBankPage';
import AiManagementPage from '../pages/ai-management/AiManagementPage';
import PaymentsPage from '../pages/payments/PaymentsPage';
import ReportsPage from '../pages/reports/ReportsPage';
import SettingsPage from '../pages/settings/SettingsPage';

export const AppRoutes: React.FC = () => {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="/dashboard" element={<DashboardPage />} />
      <Route path="/schools" element={<SchoolsPage />} />
      <Route path="/school-admins" element={<SchoolAdminsPage />} />
      <Route path="/students" element={<StudentsPage />} />
      <Route path="/batches" element={<BatchesPage />} />
      <Route path="/courses" element={<CoursesPage />} />
      <Route path="/question-bank" element={<QuestionBankPage />} />
      <Route path="/ai-management" element={<AiManagementPage />} />
      <Route path="/payments" element={<PaymentsPage />} />
      <Route path="/reports" element={<ReportsPage />} />
      <Route path="/settings" element={<SettingsPage />} />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
};

export default AppRoutes;
