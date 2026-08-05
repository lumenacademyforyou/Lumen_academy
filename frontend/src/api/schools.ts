import { axiosClient } from "./axios";

export const getSchools = () =>
  axiosClient.get("/schools");

export const getSchoolById = (id: string) =>
  axiosClient.get(`/schools/${id}`);

export const updateSchool = (id: string, data: any) =>
  axiosClient.put(`/schools/${id}`, data);

export const deleteSchool = (id: string) =>
  axiosClient.delete(`/schools/${id}`);