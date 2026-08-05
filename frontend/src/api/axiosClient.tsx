import axios from 'axios';

export const axiosClient = axios.create({
  baseURL: 'https://api.lumenacademy.edu/v1/superadmin',
  headers: {
    'Content-Type': 'application/json',
  },
});
