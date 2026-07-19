/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface AffiliateRecord {
  id?: string;
  nombre: string;
  apellido?: string;
  dni: string;
  fechaNacimiento: string; // YYYY-MM-DD format or string representation
  tipoAfiliacion: "SOCIA BENEFICIARIA" | "SOCIA VOLUNTARIAS" | string;
  rama?: string;
  // Raw fields used during parsing
  rawRow?: Record<string, string>;
}

export interface ReferenceDB {
  voluntarias: AffiliateRecord[];
  ramas: {
    [ramaName: string]: AffiliateRecord[];
  };
}

export type ComparisonStatus = "MATCH" | "NO_MATCH" | "RAMA_MISMATCH" | "INVALID_DATA";

export interface ComparisonResult {
  id: string;
  record: AffiliateRecord;
  status: ComparisonStatus;
  matchedWith?: AffiliateRecord;
  details: string;
}

export interface UserSession {
  username: string;
  role: string;
  token?: string;
}
