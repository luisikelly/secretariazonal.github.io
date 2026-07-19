/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { AffiliateRecord, ReferenceDB, ComparisonResult, ComparisonStatus } from "../types";

/**
 * Normalizes text: lowercase, removes accents, collapses spaces.
 */
export function normalizeString(str: string | undefined | null): string {
  if (!str) return "";
  return str
    .toString()
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // Remove accents
    .replace(/\s+/g, " "); // Collapse multiple spaces
}

/**
 * Normalizes DNI: removes dots, hyphens, and leading zeros.
 */
export function normalizeDni(dni: string | number | undefined | null): string {
  if (dni === undefined || dni === null) return "";
  return dni.toString().replace(/[^a-zA-Z0-9]/g, "").replace(/^0+/, "");
}

/**
 * Normalizes date to YYYY-MM-DD or standard numeric sequence.
 */
export function normalizeDate(dateVal: any): string {
  if (!dateVal) return "";
  
  let str = dateVal.toString().trim();
  
  // If it's an Excel serial number
  if (/^\d{5}$/.test(str)) {
    const serial = parseInt(str, 10);
    const excelEpoch = new Date(1899, 11, 30);
    const date = new Date(excelEpoch.getTime() + serial * 86400000);
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }

  // Handle DD/MM/YYYY or DD-MM-YYYY
  const dmyMatch = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (dmyMatch) {
    const [, d, m, y] = dmyMatch;
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }

  // Handle YYYY/MM/DD or YYYY-MM-DD
  const ymdMatch = str.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/);
  if (ymdMatch) {
    const [, y, m, d] = ymdMatch;
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }

  try {
    const parsed = new Date(str);
    if (!isNaN(parsed.getTime())) {
      const yyyy = parsed.getFullYear();
      const mm = String(parsed.getMonth() + 1).padStart(2, '0');
      const dd = String(parsed.getDate()).padStart(2, '0');
      return `${yyyy}-${mm}-${dd}`;
    }
  } catch (e) {
    // Fallback to numeric clean
  }

  // Clean non-numeric characters for simple numeric comparison
  return str.replace(/[^0-9]/g, "");
}

/**
 * Flexible name matching, case-insensitive, word order independent.
 */
export function isNameMatch(
  name1: string,
  lastName1: string | undefined,
  name2: string,
  lastName2: string | undefined
): boolean {
  const full1 = normalizeString(((name1 || "") + " " + (lastName1 || "")).trim());
  const full2 = normalizeString(((name2 || "") + " " + (lastName2 || "")).trim());
  
  if (full1 === full2) return true;
  
  // Word order independent check
  const words1 = full1.split(" ").filter(Boolean);
  const words2 = full2.split(" ").filter(Boolean);
  
  if (words1.length === words2.length && words1.length > 0) {
    const set2 = new Set(words2);
    const matchAll = words1.every(w => set2.has(w));
    if (matchAll) return true;
  }
  
  // Subset check (flexible matching for compound names)
  if (words1.length > 0 && words2.length > 0) {
    const contains = full1.includes(full2) || full2.includes(full1);
    if (contains && (words1.length >= 2 || words2.length >= 2)) {
      return true;
    }
  }
  
  return false;
}

/**
 * Compares a single input record against the reference database.
 */
export function compareRecord(
  input: AffiliateRecord,
  reference: ReferenceDB
): { status: ComparisonStatus; matchedWith?: AffiliateRecord; details: string } {
  // 1. Basic validation
  if (!input.nombre && !input.apellido) {
    return { status: "INVALID_DATA", details: "Faltan campos de nombre y apellido" };
  }
  if (!input.dni) {
    return { status: "INVALID_DATA", details: "Falta el campo DNI" };
  }
  
  const cleanInputDni = normalizeDni(input.dni);
  const cleanInputDate = normalizeDate(input.fechaNacimiento);
  const cleanInputTipo = normalizeString(input.tipoAfiliacion);
  const cleanInputRama = normalizeString(input.rama);

  // Determine target search section
  let targetList: AffiliateRecord[] = [];
  let isVoluntaria = false;

  if (cleanInputTipo.includes("voluntaria")) {
    targetList = reference.voluntarias;
    isVoluntaria = true;
  } else if (cleanInputTipo.includes("beneficiaria")) {
    // Look up the specific branch (Rama) under Sección 8
    const matchingRamaKey = Object.keys(reference.ramas).find(
      (ramaKey) => normalizeString(ramaKey) === cleanInputRama || normalizeString(ramaKey).includes(cleanInputRama) || cleanInputRama.includes(normalizeString(ramaKey))
    );

    if (matchingRamaKey) {
      targetList = reference.ramas[matchingRamaKey];
    } else {
      // Rama not found in reference DB
      // We still search all branches to see if they are in the wrong Rama
      let foundInWrongRama: AffiliateRecord | undefined = undefined;
      let wrongRamaName = "";
      
      for (const [ramaKey, records] of Object.entries(reference.ramas)) {
        const match = records.find((ref) => {
          const dniMatch = normalizeDni(ref.dni) === cleanInputDni;
          const nameMatch = isNameMatch(input.nombre, input.apellido, ref.nombre, ref.apellido);
          return dniMatch || nameMatch;
        });
        if (match) {
          foundInWrongRama = match;
          wrongRamaName = ramaKey;
          break;
        }
      }

      if (foundInWrongRama) {
        return {
          status: "RAMA_MISMATCH",
          matchedWith: foundInWrongRama,
          details: `Afiliada encontrada en Rama '${wrongRamaName}' pero declarada en Rama '${input.rama || "N/A"}'`
        };
      }

      return {
        status: "NO_MATCH",
        details: `No se encontró la Rama de referencia '${input.rama || "Sin Rama"}' en Sección 8`
      };
    }
  } else {
    // If tipoAfiliacion is unrecognized, we search both lists to be helpful
    targetList = [...reference.voluntarias, ...Object.values(reference.ramas).flat()];
  }

  // 2. Perform comparison against the selected target list
  // Match criteria: matching DNI OR matching Name+Lastname, then verify remaining fields
  let bestMatch: AffiliateRecord | undefined = undefined;
  
  // Primary search by exact DNI
  bestMatch = targetList.find((ref) => normalizeDni(ref.dni) === cleanInputDni);

  if (bestMatch) {
    // DNI matched, now verify Name and Birthdate for high confidence
    const nameMatches = isNameMatch(input.nombre, input.apellido, bestMatch.nombre, bestMatch.apellido);
    const dateMatches = cleanInputDate && normalizeDate(bestMatch.fechaNacimiento) === cleanInputDate;

    if (nameMatches && dateMatches) {
      return {
        status: "MATCH",
        matchedWith: bestMatch,
        details: "Coincidencia perfecta (DNI, Nombre y Fecha de Nacimiento)"
      };
    } else if (nameMatches) {
      return {
        status: "MATCH",
        matchedWith: bestMatch,
        details: `Coincidencia parcial: DNI y Nombre correctos, pero la Fecha de Nacimiento difiere (Input: ${input.fechaNacimiento}, Ref: ${bestMatch.fechaNacimiento})`
      };
    } else if (dateMatches) {
      return {
        status: "MATCH",
        matchedWith: bestMatch,
        details: `Coincidencia parcial: DNI y Fecha de Nacimiento correctos, pero el Nombre difiere (Input: ${input.nombre} ${input.apellido || ""}, Ref: ${bestMatch.nombre} ${bestMatch.apellido || ""})`
      };
    } else {
      return {
        status: "NO_MATCH",
        matchedWith: bestMatch,
        details: `DNI coincide, pero el Nombre y la Fecha de Nacimiento son completamente diferentes. Posible error de carga.`
      };
    }
  }

  // Secondary search by Name (since DNI didn't match, maybe typo in DNI)
  bestMatch = targetList.find((ref) => isNameMatch(input.nombre, input.apellido, ref.nombre, ref.apellido));

  if (bestMatch) {
    const dateMatches = cleanInputDate && normalizeDate(bestMatch.fechaNacimiento) === cleanInputDate;
    if (dateMatches) {
      return {
        status: "MATCH",
        matchedWith: bestMatch,
        details: `Coincidencia parcial: Nombre y Fecha de Nacimiento correctos, pero el DNI difiere (Input: ${input.dni}, Ref: ${bestMatch.dni})`
      };
    } else {
      return {
        status: "NO_MATCH",
        matchedWith: bestMatch,
        details: `El Nombre coincide, pero el DNI (${input.dni} vs ${bestMatch.dni}) y la Fecha de Nacimiento no coinciden.`
      };
    }
  }

  // 3. Fallback: Check if the person exists in OTHER sections
  // E.g., if we were searching Voluntarias, maybe they are listed in a Rama under Sección 8
  if (isVoluntaria) {
    // Search in all Ramas
    for (const [ramaKey, records] of Object.entries(reference.ramas)) {
      const match = records.find((ref) => {
        const dniMatch = normalizeDni(ref.dni) === cleanInputDni;
        const nameMatch = isNameMatch(input.nombre, input.apellido, ref.nombre, ref.apellido);
        return dniMatch || nameMatch;
      });
      if (match) {
        return {
          status: "RAMA_MISMATCH",
          matchedWith: match,
          details: `Registrada como 'SOCIA VOLUNTARIAS', pero figura en la 'Sección 8 - Rama ${ramaKey}'`
        };
      }
    }
  } else {
    // We were searching a specific Rama, let's search Voluntarias
    const matchInVol = reference.voluntarias.find((ref) => {
      const dniMatch = normalizeDni(ref.dni) === cleanInputDni;
      const nameMatch = isNameMatch(input.nombre, input.apellido, ref.nombre, ref.apellido);
      return dniMatch || nameMatch;
    });
    if (matchInVol) {
      return {
        status: "RAMA_MISMATCH",
        matchedWith: matchInVol,
        details: `Registrada como 'SOCIA BENEFICIARIA' en Rama '${input.rama || "N/A"}', pero figura en 'Sección 8.1 Voluntarias'`
      };
    }

    // Also search other Ramas
    for (const [ramaKey, records] of Object.entries(reference.ramas)) {
      if (normalizeString(ramaKey) === cleanInputRama) continue;
      const match = records.find((ref) => {
        const dniMatch = normalizeDni(ref.dni) === cleanInputDni;
        const nameMatch = isNameMatch(input.nombre, input.apellido, ref.nombre, ref.apellido);
        return dniMatch || nameMatch;
      });
      if (match) {
        return {
          status: "RAMA_MISMATCH",
          matchedWith: match,
          details: `Registrada en Rama '${input.rama || "N/A"}', pero figura en la 'Sección 8 - Rama ${ramaKey}'`
        };
      }
    }
  }

  return {
    status: "NO_MATCH",
    details: "No se encontraron coincidencias por DNI ni Nombre en la sección de referencia especificada."
  };
}

/**
 * Compares an array of input records against reference database.
 */
export function compareDataset(
  inputs: AffiliateRecord[],
  reference: ReferenceDB
): ComparisonResult[] {
  return inputs.map((input, index) => {
    const { status, matchedWith, details } = compareRecord(input, reference);
    return {
      id: input.id || `input-${index}-${Date.now()}`,
      record: input,
      status,
      matchedWith,
      details
    };
  });
}
