import type { UnitMaterialModel } from "./unit_material.model.js";
import { pool } from "../../shared/pool.js";
import { NotFoundError } from "../../shared/errors.js";

export type UnitMaterialId = string;

export interface UnitMaterialRepository {
  findById(id: UnitMaterialId): Promise<UnitMaterialModel>;
  findByUnit(unitId: string): Promise<UnitMaterialModel[]>;
  findByUnitTagCodes(tagCodes: string[]): Promise<(UnitMaterialModel & { unit_tag_code: string })[]>;
}

/**
 * @throws {NotFoundError} id does not match any active row
 */
async function findById(id: UnitMaterialId): Promise<UnitMaterialModel> {
  const res = await pool.query<UnitMaterialModel>(`select * from learn.unit_material where id = $1 and is_active`, [id]);
  if (res.rowCount === 0) throw new NotFoundError("learn.unit_material", id);
  return res.rows[0];
}

async function findByUnit(unitId: string): Promise<UnitMaterialModel[]> {
  const res = await pool.query<UnitMaterialModel>(
    `select * from learn.unit_material where unit_id = $1 and is_active order by sort_order`,
    [unitId]
  );
  return res.rows;
}

/**
 * Task 4c — "materials render grouped under their unit, in sort_order" for
 * potentially many units in one page load (e.g. a whole-subject syllabus
 * view) without one round trip per unit.
 */
async function findByUnitTagCodes(tagCodes: string[]): Promise<(UnitMaterialModel & { unit_tag_code: string })[]> {
  const res = await pool.query<UnitMaterialModel & { unit_tag_code: string }>(
    `select m.*, sn.tag_code as unit_tag_code
       from learn.unit_material m
       join catalog.syllabus_node sn on sn.node_id = m.unit_id
      where sn.tag_code = any($1::text[]) and m.is_active
      order by sn.tag_code, m.sort_order`,
    [tagCodes]
  );
  return res.rows;
}

export const unitMaterialRepository: UnitMaterialRepository = { findById, findByUnit, findByUnitTagCodes };
