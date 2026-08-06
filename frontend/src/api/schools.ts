import { axiosClient } from "./axios";

export interface School {
  id: string;
  name: string;
  code: string;
  board?: string;
  schoolType?: string;
  medium?: string;
  address?: string;
  district?: string;
  state?: string;
  pincode?: string;
  plan?: string;
  maxStudents?: number;
  subscriptionStart?: string;
  subscriptionEnd?: string;
  status?: "ACTIVE" | "INACTIVE" | "TRIAL" | "active" | "inactive" | "pending";
  createdAt?: string;
  updatedAt?: string;
}

export const getSchools = (params?: Record<string, any>) =>
  axiosClient.get("/schools", { params });

export const getSchoolById = (id: string) =>
  axiosClient.get(`/schools/${id}`);

export const createSchool = (data: Partial<School>) =>
  axiosClient.post("/schools", data);

export const updateSchool = (id: string, data: Partial<School>) =>
  axiosClient.put(`/schools/${id}`, data);

export const deleteSchool = (id: string) =>
  axiosClient.delete(`/schools/${id}`);