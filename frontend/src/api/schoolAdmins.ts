import { axiosClient } from "./axios";

export interface SchoolAdmin {
  id?: string;
  _id?: string;
  schoolId: string;
  name: string;
  email: string;
  phone?: string;
  role?: string;
  status: "ACTIVE" | "SUSPENDED" | "active" | "suspended";
  lastLogin?: string;
  createdAt?: string;
  updatedAt?: string;
  school?: {
    id: string;
    name: string;
    code: string;
  };
}

export const getSchoolAdmins = (params?: Record<string, any>) =>
  axiosClient.get("/school-admins", { params });

export const getSchoolAdminById = (id: string) =>
  axiosClient.get(`/school-admins/${id}`);

export const updateSchoolAdmin = (id: string, data: Partial<SchoolAdmin>) =>
  axiosClient.put(`/school-admins/${id}`, data);

export const updateSchoolAdminStatus = (id: string, status: string) =>
  axiosClient.patch(`/school-admins/${id}/status`, { status });

export const deleteSchoolAdmin = (id: string) =>
  axiosClient.delete(`/school-admins/${id}`);