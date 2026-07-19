/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { ReferenceDB } from "../types";

export const mockReferenceDB: ReferenceDB = {
  voluntarias: [
    {
      nombre: "María Elena",
      apellido: "Gómez",
      dni: "34567890",
      fechaNacimiento: "1989-04-12",
      tipoAfiliacion: "SOCIA VOLUNTARIAS",
    },
    {
      nombre: "Laura Beatriz",
      apellido: "Fernández",
      dni: "28456123",
      fechaNacimiento: "1980-11-23",
      tipoAfiliacion: "SOCIA VOLUNTARIAS",
    },
    {
      nombre: "Clara Inés",
      apellido: "Rodríguez",
      dni: "41098456",
      fechaNacimiento: "1998-07-05",
      tipoAfiliacion: "SOCIA VOLUNTARIAS",
    }
  ],
  ramas: {
    "8.2 Pimpollitos": [
      {
        nombre: "Sofia Valentina",
        apellido: "Peralta",
        dni: "48123456",
        fechaNacimiento: "2018-03-12",
        tipoAfiliacion: "SOCIA BENEFICIARIA",
        rama: "8.2 Pimpollitos"
      },
      {
        nombre: "Emma Luz",
        apellido: "Martínez",
        dni: "49123457",
        fechaNacimiento: "2019-05-18",
        tipoAfiliacion: "SOCIA BENEFICIARIA",
        rama: "8.2 Pimpollitos"
      }
    ],
    "8.3 Alitas": [
      {
        nombre: "Catalina Paz",
        apellido: "Romero",
        dni: "46123458",
        fechaNacimiento: "2015-10-22",
        tipoAfiliacion: "SOCIA BENEFICIARIA",
        rama: "8.3 Alitas"
      },
      {
        nombre: "Martina Belén",
        apellido: "Silva",
        dni: "45123459",
        fechaNacimiento: "2014-08-05",
        tipoAfiliacion: "SOCIA BENEFICIARIA",
        rama: "8.3 Alitas"
      }
    ],
    "8.4 Guías en Caravana": [
      {
        nombre: "Valentina Sol",
        apellido: "López",
        dni: "42123460",
        fechaNacimiento: "2010-12-14",
        tipoAfiliacion: "SOCIA BENEFICIARIA",
        rama: "8.4 Guías en Caravana"
      },
      {
        nombre: "Mia Isabella",
        apellido: "Díaz",
        dni: "43123461",
        fechaNacimiento: "2011-04-20",
        tipoAfiliacion: "SOCIA BENEFICIARIA",
        rama: "8.4 Guías en Caravana"
      }
    ],
    "8.5 Guías del Sol": [
      {
        nombre: "Delfina Rocío",
        apellido: "Gómez",
        dni: "39123462",
        fechaNacimiento: "2007-06-30",
        tipoAfiliacion: "SOCIA BENEFICIARIA",
        rama: "8.5 Guías del Sol"
      },
      {
        nombre: "Zoe Abigail",
        apellido: "Castro",
        dni: "40123463",
        fechaNacimiento: "2008-01-15",
        tipoAfiliacion: "SOCIA BENEFICIARIA",
        rama: "8.5 Guías del Sol"
      }
    ],
    "8.6 Guías Mayores": [
      {
        nombre: "Victoria Luján",
        apellido: "Álvarez",
        dni: "36123464",
        fechaNacimiento: "2002-11-09",
        tipoAfiliacion: "SOCIA BENEFICIARIA",
        rama: "8.6 Guías Mayores"
      },
      {
        nombre: "Juana Inés",
        apellido: "Benítez",
        dni: "37123465",
        fechaNacimiento: "2004-09-25",
        tipoAfiliacion: "SOCIA BENEFICIARIA",
        rama: "8.6 Guías Mayores"
      }
    ],
    "8.7 Mariposas": [
      {
        nombre: "Camila Agustina",
        apellido: "Torres",
        dni: "44123466",
        fechaNacimiento: "2013-02-07",
        tipoAfiliacion: "SOCIA BENEFICIARIA",
        rama: "8.7 Mariposas"
      },
      {
        nombre: "Olivia Mailén",
        apellido: "Rodríguez",
        dni: "44123467",
        fechaNacimiento: "2012-07-19",
        tipoAfiliacion: "SOCIA BENEFICIARIA",
        rama: "8.7 Mariposas"
      }
    ]
  }
};

/**
 * Generates a mock sample CSV file content that can be downloaded or loaded in-app
 * to show perfect matches, mismatches, and incorrect ramas.
 */
export const demoCSVContent = `Nombre,Apellido,DNI,Fecha de Nacimiento,Tipo Afiliacion,Rama
Sofia Valentina,Peralta,48.123.456,12/03/2018,SOCIA BENEFICIARIA,8.2 Pimpollitos
María Elena,Gómez,34.567.890,12/04/1989,SOCIA VOLUNTARIAS,
Catalina Paz,Romero,46123458,22-10-2015,SOCIA BENEFICIARIA,8.3 Alitas
Emma Luz,Martínez,49123457,18/05/2019,SOCIA BENEFICIARIA,8.3 Alitas
Laura Beatriz,Fernandez,28456123,23/11/1980,SOCIA BENEFICIARIA,8.4 Guías en Caravana
Delfina Rocío,Gómez,11111111,30/06/2007,SOCIA BENEFICIARIA,8.5 Guías del Sol
`;
