import { Prisma, SchoolStatus } from '@prisma/client';
import prisma from '../../config/prisma';
import { ApiError } from '../../utils/apiError';
import { getPaginationParams, buildPaginatedResponse } from '../../utils/pagination';

interface GetSchoolsQuery {
  page?: string;
  limit?: string;
  search?: string;
  state?: string;
  district?: string;
  board?: string;
  status?: SchoolStatus;
}


export const createSchool = async (data: any) => {
  return prisma.school.create({
    data,
  });
};
export const getAllSchools = async (query: GetSchoolsQuery) => {
  const { page, limit, skip } = getPaginationParams(query);

  const where: Prisma.SchoolWhereInput = {
    ...(query.search && {
      OR: [
        { name: { contains: query.search, mode: 'insensitive' } },
        { code: { contains: query.search, mode: 'insensitive' } },
      ],
    }),
    ...(query.state && { state: query.state }),
    ...(query.district && { district: query.district }),
    ...(query.board && { board: query.board }),
    ...(query.status && { status: query.status }),
  };

  const [items, total] = await Promise.all([
    prisma.school.findMany({ where, skip, take: limit, orderBy: { createdAt: 'desc' } }),
    prisma.school.count({ where }),
  ]);

  return buildPaginatedResponse(items, total, page, limit);
};

export const getSchoolById = async (id: string) => {
  const school = await prisma.school.findUnique({
    where: { id },
    include: { admins: true },
  });
  if (!school) throw new ApiError(404, 'School not found');
  return school;
};

export const updateSchool = async (id: string, data: Prisma.SchoolUpdateInput) => {
  await getSchoolById(id); // 404s early if missing
  return prisma.school.update({ where: { id }, data });
};

export const deleteSchool = async (id: string) => {
  await getSchoolById(id);
  await prisma.school.delete({ where: { id } });
};