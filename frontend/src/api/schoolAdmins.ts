import { axiosClient } from "./axios";
export interface SchoolAdmin {
  _id: string;
  schoolId: string;
  name: string;
  email: string;
  phone: string;
  role: string;
  status: "active" | "suspended";
  lastLogin?: string;
}

export const getSchoolAdmins = () =>
  axiosClient.get("/school-admins");

export const getSchoolAdminById = (id: string) =>
  axiosClient.get(`/school-admins/${id}`);

export const updateSchoolAdmin = (
  id: string,
  data: any
) => axiosClient.put(`/school-admins/${id}`, data);

export const updateSchoolAdminStatus = (
  id: string,
  status: string
) =>
  axiosClient.patch(`/school-admins/${id}/status`, {
    status,
  });

export const deleteSchoolAdmin = (id: string) =>
  axiosClient.delete(`/school-admins/${id}`);