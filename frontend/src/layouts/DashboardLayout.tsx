import React from 'react';
import { Layout } from '../components/layout/Layout';

interface DashboardLayoutProps {
  children: React.ReactNode;
  pageTitle?: string;
}

export const DashboardLayout: React.FC<DashboardLayoutProps> = ({ children, pageTitle }) => {
  return <Layout pageTitle={pageTitle}>{children}</Layout>;
};

export default DashboardLayout;
