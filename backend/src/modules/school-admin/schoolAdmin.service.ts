import { AdminStatus, Prisma } from '@prisma/client';
import prisma from '../../config/prisma';
import { ApiError } from '../../utils/apiError';
import { getPaginationParams, buildPaginatedResponse } from '../../utils/pagination';

interface GetAdminsQuery {
  page?: string;
  limit?: string;
  search?: string;
  schoolId?: string;
  status?: AdminStatus;
}

export const getAllSchoolAdmins = async (query: GetAdminsQuery) => {
  const { page, limit, skip } = getPaginationParams(query);

  const where: Prisma.SchoolAdminWhereInput = {
    ...(query.search && {
      OR: [
        { name: { contains: query.search, mode: 'insensitive' } },
        { email: { contains: query.search, mode: 'insensitive' } },
      ],
    }),
    ...(query.schoolId && { schoolId: query.schoolId }),
    ...(query.status && { status: query.status }),
  };

  const [items, total] = await Promise.all([
    prisma.schoolAdmin.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: { school: { select: { id: true, name: true, code: true } } },
    }),
    prisma.schoolAdmin.count({ where }),
  ]);

  return buildPaginatedResponse(items, total, page, limit);
};

export const getSchoolAdminById = async (id: string) => {
  const admin = await prisma.schoolAdmin.findUnique({
    where: { id },
    include: { school: true },
  });
  if (!admin) throw new ApiError(404, 'School admin not found');
  return admin;
};

export const updateSchoolAdmin = async (id: string, data: Prisma.SchoolAdminUpdateInput) => {
  await getSchoolAdminById(id);
  return prisma.schoolAdmin.update({ where: { id }, data });
};

export const setSchoolAdminStatus = async (id: string, status: AdminStatus) => {
  await getSchoolAdminById(id);
  return prisma.schoolAdmin.update({ where: { id }, data: { status } });
};

export const deleteSchoolAdmin = async (id: string) => {
  await getSchoolAdminById(id);
  await prisma.schoolAdmin.delete({ where: { id } });
};