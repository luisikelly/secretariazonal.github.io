/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from "react";
import Papa from "papaparse";
import * as XLSX from "xlsx";
import { 
  Upload, FileText, Database, ShieldAlert, CheckCircle2, 
  AlertTriangle, XCircle, Search, Download, HelpCircle, 
  ArrowRight, RefreshCw, FileCheck2, Filter, Layers, 
  Users, ExternalLink, Settings, Info, Plus, Trash2, Mail, Copy, Check
} from "lucide-react";
import { AffiliateRecord, ReferenceDB, ComparisonResult, ComparisonStatus } from "../types";
import { compareDataset } from "../utils/comparator";
import { mockReferenceDB, demoCSVContent } from "../data/mockReferenceDB";
import { initAuth, googleSignIn, logoutGoogle } from "../utils/firebaseAuth";

// ============================================================================
// PARSERS FOR TEXT-BASED CAMPOUT PLAN DOCUMENTS (.PDF, .DOCX, .DOC, .TXT)
// ============================================================================

export function parseParticipantLine(line: string): { nombre: string, apellido?: string, dni: string, fechaNacimiento: string } | null {
  const cleanLine = line.trim();
  if (!cleanLine) return null;

  const lowerLine = cleanLine.toLowerCase();
  if (lowerLine.includes("nombre") && lowerLine.includes("documento")) return null;
  if (lowerLine.includes("tipo") && lowerLine.includes("rama")) return null;
  if (lowerLine.includes("nro") && lowerLine.includes("nacimiento")) return null;

  // 1. Extract DNI (7 to 9 digits, sometimes with dots)
  const dniMatch = cleanLine.match(/\b\d{1,2}(?:\.?\d{3}){2}\b|\b\d{7,9}\b/);
  if (!dniMatch) return null; // A valid participant must have a DNI

  const rawDni = dniMatch[0];
  const dni = rawDni.replace(/\./g, "");

  // 2. Extract Date (DD/MM/YYYY or YYYY-MM-DD or DD-MM-YYYY)
  const dateMatch = cleanLine.match(/\b\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4}\b|\b\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2}\b/);
  let fechaNacimiento = "";
  if (dateMatch) {
    fechaNacimiento = dateMatch[0];
  }

  // 3. Extract Name & Surname
  let namePart = cleanLine
    .replace(rawDni, "")
    .replace(fechaNacimiento ? fechaNacimiento : "", "")
    .replace(/^[-*•\d\.\s,;]+/, "") // Remove list bullets, numbers, punctuation from start
    .replace(/[-*•\s,;]+$/, "")     // Remove from end
    .trim();

  // If there are words left
  if (namePart.length < 3) return null;

  const words = namePart.split(/\s+/).filter(w => w.length > 0);
  let nombre = "";
  let apellido = "";

  if (words.length > 1) {
    const commaIndex = namePart.indexOf(",");
    if (commaIndex !== -1) {
      const part1 = namePart.substring(0, commaIndex).trim();
      const part2 = namePart.substring(commaIndex + 1).trim();
      apellido = part1;
      nombre = part2;
    } else {
      apellido = words[words.length - 1];
      nombre = words.slice(0, words.length - 1).join(" ");
    }
  } else {
    nombre = words[0];
  }

  return {
    nombre,
    apellido: apellido || undefined,
    dni,
    fechaNacimiento
  };
}

const parseRawTextToParticipants = (text: string): AffiliateRecord[] => {
  const lines = text.split(/\r?\n/);
  const records: AffiliateRecord[] = [];
  
  let currentTipo = "SOCIA BENEFICIARIA";
  let currentRama = "";

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    const normalizedLine = trimmed.toLowerCase();
    
    // Check if the line is a section header and transition states
    if (normalizedLine.includes("8.1") || (normalizedLine.includes("seccion 8") && normalizedLine.includes("voluntaria"))) {
      currentTipo = "SOCIA VOLUNTARIAS";
      currentRama = "";
      continue;
    }
    if (normalizedLine.includes("8.2") || normalizedLine.includes("pimpollitos") || normalizedLine.includes("pimpollito")) {
      currentTipo = "SOCIA BENEFICIARIA";
      currentRama = "8.2 Pimpollitos";
      continue;
    }
    if (normalizedLine.includes("8.3") || normalizedLine.includes("alitas") || normalizedLine.includes("alita")) {
      currentTipo = "SOCIA BENEFICIARIA";
      currentRama = "8.3 Alitas";
      continue;
    }
    if (normalizedLine.includes("8.4") || normalizedLine.includes("caravana") || normalizedLine.includes("caravanas")) {
      currentTipo = "SOCIA BENEFICIARIA";
      currentRama = "8.4 Guías en Caravana";
      continue;
    }
    if (normalizedLine.includes("8.5") || normalizedLine.includes("del sol") || normalizedLine.includes("guias del sol")) {
      currentTipo = "SOCIA BENEFICIARIA";
      currentRama = "8.5 Guías del Sol";
      continue;
    }
    if (normalizedLine.includes("8.6") || normalizedLine.includes("mayores") || normalizedLine.includes("guias mayores")) {
      currentTipo = "SOCIA BENEFICIARIA";
      currentRama = "8.6 Guías Mayores";
      continue;
    }
    if (normalizedLine.includes("8.7") || normalizedLine.includes("mariposas") || normalizedLine.includes("mariposa")) {
      currentTipo = "SOCIA BENEFICIARIA";
      currentRama = "8.7 Mariposas";
      continue;
    }

    // Try parsing a participant from this line
    const parsed = parseParticipantLine(trimmed);
    if (parsed) {
      records.push({
        nombre: parsed.nombre,
        apellido: parsed.apellido,
        dni: parsed.dni,
        fechaNacimiento: parsed.fechaNacimiento,
        tipoAfiliacion: currentTipo,
        rama: currentRama || undefined
      });
    }
  }

  return records;
};

// PDF/DOCX extractors
const readPdfText = async (file: File): Promise<string> => {
  const arrayBuffer = await file.arrayBuffer();
  if ((window as any).pdfjsLib) {
    (window as any).pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
  }
  const loadingTask = (window as any).pdfjsLib.getDocument({ data: arrayBuffer });
  const pdf = await loadingTask.promise;
  let fullText = "";

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    const pageText = textContent.items.map((item: any) => item.str).join(" ");
    fullText += pageText + "\n";
  }

  return fullText;
};

const readDocxText = async (file: File): Promise<string> => {
  const arrayBuffer = await file.arrayBuffer();
  const result = await (window as any).mammoth.extractRawText({ arrayBuffer });
  return result.value;
};

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState<"validate" | "reference" | "sync">("validate");
  const [referenceDB, setReferenceDB] = useState<ReferenceDB>(mockReferenceDB);
  
  // File upload states
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [parsedRecords, setParsedRecords] = useState<AffiliateRecord[]>([]);
  const [comparisonResults, setComparisonResults] = useState<ComparisonResult[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [dragActive, setDragActive] = useState(false);

  // Search & Filter states for results
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [resultsPage, setResultsPage] = useState(1);
  const resultsPerPage = 10;

  // Search & Filter for reference db explorer
  const [refSearch, setRefSearch] = useState("");
  const [refSectionFilter, setRefSectionFilter] = useState<string>("ALL");
  
  // Custom reference record form state
  const [showAddRefModal, setShowAddRefModal] = useState(false);
  const [newRefName, setNewRefName] = useState("");
  const [newRefLastName, setNewRefLastName] = useState("");
  const [newRefDni, setNewRefDni] = useState("");
  const [newRefDate, setNewRefDate] = useState("");
  const [newRefTipo, setNewRefTipo] = useState("SOCIA BENEFICIARIA");
  const [newRefRama, setNewRefRama] = useState("8.2 Pimpollitos");

  // Google Sync & Auth States
  const [googleSheetId, setGoogleSheetId] = useState("");
  const [isGoogleSynced, setIsGoogleSynced] = useState(false);
  const [syncLoading, setSyncLoading] = useState(false);
  const [googleUser, setGoogleUser] = useState<any>(null);
  const [googleToken, setGoogleToken] = useState<string | null>(null);
  const [googleSpreadsheets, setGoogleSpreadsheets] = useState<any[]>([]);
  const [baseDeDatosReferencia, setBaseDeDatosReferencia] = useState<AffiliateRecord[]>(() => {
    const initial: AffiliateRecord[] = [];
    mockReferenceDB.voluntarias.forEach(r => initial.push(r));
    Object.values(mockReferenceDB.ramas).forEach(list => {
      list.forEach(r => initial.push(r));
    });
    return initial;
  });
  const [syncStatusMsg, setSyncStatusMsg] = useState<{ type: "success" | "error" | "info"; text: string } | null>(null);
  const [emailCopied, setEmailCopied] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Helper to dynamically map columns from Excel or CSV row to our AffiliateRecord
  const mapRowToAffiliate = (row: any): AffiliateRecord => {
    const keys = Object.keys(row);
    let nombre = "";
    let apellido = "";
    let dni = "";
    let fechaNacimiento = "";
    let tipoAfiliacion = "";
    let rama = "";

    const findValue = (possibleHeaders: string[]) => {
      const foundKey = keys.find(k => 
        possibleHeaders.some(h => {
          const normKey = k.toLowerCase().trim().replace(/_/g, " ").replace(/á/g, "a").replace(/é/g, "e").replace(/í/g, "i").replace(/ó/g, "o").replace(/ú/g, "u");
          const normH = h.toLowerCase().trim();
          return normKey.includes(normH) || normH.includes(normKey);
        })
      );
      return foundKey ? row[foundKey] : undefined;
    };

    const dniVal = findValue(["dni", "documento", "nro documento", "cedula", "nro_documento", "id"]);
    const tipoVal = findValue(["tipo afiliacion", "tipo de afiliacion", "tipo", "afiliacion", "tipo_afiliacion"]);
    const ramaVal = findValue(["rama", "seccion", "rama de actividad", "rama_actividad"]);
    const fechaVal = findValue(["fecha de nacimiento", "fecha nacimiento", "nacimiento", "birthdate", "fecha_nacimiento", "fecha"]);

    const nombreVal = findValue(["nombre", "primer nombre", "nombres"]);
    const apellidoVal = findValue(["apellido", "apellidos"]);
    const completoVal = findValue(["nombre completo", "nombre y apellido", "afiliado", "nombre_apellido", "full name"]);

    if (nombreVal) nombre = nombreVal.toString().trim();
    if (apellidoVal) apellido = apellidoVal.toString().trim();
    
    if (!nombre && completoVal) {
      const parts = completoVal.toString().trim().split(/\s+/);
      if (parts.length > 1) {
        nombre = parts[0];
        apellido = parts.slice(1).join(" ");
      } else {
        nombre = completoVal.toString().trim();
      }
    }

    if (dniVal) dni = dniVal.toString().trim();
    if (fechaVal) fechaNacimiento = fechaVal.toString().trim();
    if (tipoVal) tipoAfiliacion = tipoVal.toString().trim();
    if (ramaVal) rama = ramaVal.toString().trim();

    // Default heuristics if Type is empty but Branch is present
    if (!tipoAfiliacion) {
      if (rama) {
        tipoAfiliacion = "SOCIA BENEFICIARIA";
      } else {
        tipoAfiliacion = "SOCIA VOLUNTARIAS";
      }
    }

    return {
      nombre,
      apellido: apellido || undefined,
      dni,
      fechaNacimiento,
      tipoAfiliacion,
      rama: rama || undefined,
      rawRow: row
    };
  };

  // ============================================================================
  // GOOGLE OAUTH & GOOGLE SHEETS SYNC LOGIC
  // ============================================================================

  useEffect(() => {
    // Listen to Firebase Auth state for Google account sign-in
    const unsubscribe = initAuth(
      (user, token) => {
        setGoogleUser(user);
        setGoogleToken(token);
        fetchUserSpreadsheets(token);
      },
      () => {
        setGoogleUser(null);
        setGoogleToken(null);
      }
    );
    return () => unsubscribe();
  }, []);

  const fetchUserSpreadsheets = async (token: string) => {
    try {
      const response = await fetch(
        "https://www.googleapis.com/drive/v3/files?q=mimeType%3D'application%2Fvnd.google-apps.spreadsheet'&fields=files(id%2Cname)",
        {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );
      if (response.ok) {
        const data = await response.json();
        setGoogleSpreadsheets(data.files || []);
      }
    } catch (error) {
      console.error("Error al buscar hojas de cálculo en Drive:", error);
    }
  };

  const handleGoogleLogin = async () => {
    try {
      setSyncLoading(true);
      setSyncStatusMsg({ type: "info", text: "Iniciando sesión con Google..." });
      const result = await googleSignIn();
      if (result) {
        setGoogleUser(result.user);
        setGoogleToken(result.accessToken);
        fetchUserSpreadsheets(result.accessToken);
        setSyncStatusMsg({ type: "success", text: "Conectado a Google con éxito." });
      }
    } catch (error: any) {
      setSyncStatusMsg({ type: "error", text: `Error de conexión: ${error.message || error}` });
    } finally {
      setSyncLoading(false);
    }
  };

  const handleGoogleLogout = async () => {
    await logoutGoogle();
    setGoogleUser(null);
    setGoogleToken(null);
    setGoogleSpreadsheets([]);
    setIsGoogleSynced(false);
    setSyncStatusMsg({ type: "info", text: "Sesión de Google cerrada." });
  };

  const handleDownloadSheet = async (sheetId: string) => {
    if (!googleToken) {
      setSyncStatusMsg({ type: "error", text: "Debe iniciar sesión con Google primero." });
      return;
    }
    setSyncLoading(true);
    setSyncStatusMsg({ type: "info", text: "Descargando datos de la pestaña 'Datos' de Google Sheets..." });

    try {
      const range = "Datos!A:Z";
      const response = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(range)}`,
        {
          headers: {
            Authorization: `Bearer ${googleToken}`
          }
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || "No se pudo leer la pestaña 'Datos'. Verifique que exista en su archivo.");
      }

      const data = await response.json();
      const rows = data.values;
      if (!rows || rows.length < 2) {
        throw new Error("La pestaña 'Datos' está vacía o no tiene suficientes filas (se necesita cabecera y datos).");
      }

      const headers = rows[0].map((h: string) => h.trim());

      // Find column indices case-insensitively and space/underscore independently
      const findHeaderIndex = (possibleNames: string[]) => {
        return headers.findIndex((h: string) =>
          possibleNames.some(name => h.toLowerCase().replace(/[\s_]/g, "") === name.toLowerCase().replace(/[\s_]/g, ""))
        );
      };

      const idxTipo = findHeaderIndex(["TipoAfiliacion", "TipoAfiliación", "Tipo de Afiliación", "tipo"]);
      const idxRama = findHeaderIndex(["Rama", "Sección", "Seccion", "rama"]);
      const idxNombres = findHeaderIndex(["Nombres", "Nombre", "nombres", "nombre"]);
      const idxApellidos = findHeaderIndex(["Apellidos", "Apellido", "apellidos", "apellido"]);
      const idxDni = findHeaderIndex(["NroDocumento", "Nro Documento", "DNI", "documento", "nro_documento"]);
      const idxFecha = findHeaderIndex(["FechaNacimiento", "Fecha de Nacimiento", "fecha_nacimiento", "nacimiento", "fecha_nac"]);

      const records: AffiliateRecord[] = [];
      const voluntariasList: AffiliateRecord[] = [];
      const ramasList: { [key: string]: AffiliateRecord[] } = {};

      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        if (!row || row.length === 0) continue;

        const tipo = idxTipo !== -1 && row[idxTipo] ? row[idxTipo].toString().trim() : "";
        const rama = idxRama !== -1 && row[idxRama] ? row[idxRama].toString().trim() : "";
        const nombreVal = idxNombres !== -1 && row[idxNombres] ? row[idxNombres].toString().trim() : "";
        const apellidoVal = idxApellidos !== -1 && row[idxApellidos] ? row[idxApellidos].toString().trim() : "";
        const dniVal = idxDni !== -1 && row[idxDni] ? row[idxDni].toString().trim() : "";
        const fechaVal = idxFecha !== -1 && row[idxFecha] ? row[idxFecha].toString().trim() : "";

        if (!nombreVal && !apellidoVal && !dniVal) continue; // Skip empty rows

        const newRec: AffiliateRecord = {
          nombre: nombreVal,
          apellido: apellidoVal || undefined,
          dni: dniVal,
          fechaNacimiento: fechaVal,
          tipoAfiliacion: tipo || "SOCIA BENEFICIARIA",
          rama: rama || undefined
        };

        records.push(newRec);

        if (tipo.toLowerCase().includes("voluntaria")) {
          voluntariasList.push(newRec);
        } else {
          const ramaName = rama || "Sin Rama";
          if (!ramasList[ramaName]) {
            ramasList[ramaName] = [];
          }
          ramasList[ramaName].push(newRec);
        }
      }

      setBaseDeDatosReferencia(records);
      setReferenceDB({
        voluntarias: voluntariasList,
        ramas: ramasList
      });
      setIsGoogleSynced(true);
      setSyncStatusMsg({
        type: "success",
        text: `¡Sincronización exitosa! Se cargaron ${records.length} afiliados de referencia desde Google Sheets.`
      });

    } catch (error: any) {
      console.error("Error al descargar planilla:", error);
      setSyncStatusMsg({
        type: "error",
        text: `Error al sincronizar: ${error.message || error}`
      });
    } finally {
      setSyncLoading(false);
    }
  };

  // ============================================================================
  // EMAIL GENERATION ENGINE (FORMAL OBSERVATIONS EMAIL)
  // ============================================================================

  const generateFormalEmailText = () => {
    const withObservations = comparisonResults.filter(r => r.status !== "MATCH");
    const totalCount = comparisonResults.length;
    const matchCount = comparisonResults.filter(r => r.status === "MATCH").length;
    const dateStr = new Date().toLocaleDateString("es-AR", { day: "numeric", month: "long", year: "numeric" });

    const subject = "Observaciones en la Validación de Datos - Planificación de Campamento/Acantonamiento";

    if (withObservations.length === 0) {
      const body = `Asunto: ${subject}
Fecha: ${dateStr}

Estimado Equipo de Jefatura / Hermanas Guías,

Se ha realizado la validación automática de los datos de las participantes detalladas en la Planificación de Campamento/Acantonamiento contra el Padrón de Referencia oficial almacenado en Google Drive.

Nos complace informar que no se han encontrado observaciones de discrepancias. Todos los registros coinciden perfectamente con el Padrón de Referencia oficial.

Agradecemos el compromiso con la consistencia y seguridad de la información de nuestras socias.

¡Siempre Listas para Servir!`;
      return { subject, body };
    }

    const bulletPoints = withObservations.map((obs) => {
      const fullName = `${obs.record.nombre} ${obs.record.apellido || ""}`.trim();
      const sectionName = obs.record.tipoAfiliacion === "SOCIA VOLUNTARIAS" ? "8.1 Voluntarias" : (obs.record.rama || "Sin Rama");
      
      let observacionMsg = "";
      if (obs.status === "NO_MATCH") {
        observacionMsg = "No se encuentra registrada como Socia Activa en el Padrón de Referencia.";
      } else if (obs.status === "RAMA_MISMATCH") {
        const registeredRama = obs.matchedWith?.rama || "Voluntarias";
        observacionMsg = `En el Padrón de Referencia figura registrada en la Rama ${registeredRama.toUpperCase()}, difiriendo con la sección del documento.`;
      } else {
        observacionMsg = "El número de DNI o la Fecha de Nacimiento no coincide con los registros oficiales de la base.";
      }

      return `• ${fullName} - Encontrada en sección [${sectionName}] del documento de entrada. Observación: ${observacionMsg}`;
    }).join("\n");

    const body = `Estimado Equipo de Jefatura / Hermanas Guías,

Se ha realizado la validación automática de los datos de las participantes detalladas en la Planificación de Campamento/Acantonamiento contra el Padrón de Referencia oficial almacenado en Google Drive. 

A continuación, se detallan las observaciones encontradas que requieren revisión o corrección en el archivo de entrada:

${bulletPoints}

Agradecemos realizar las modificaciones correspondientes para asegurar la consistencia y seguridad de la información de nuestras socias.

¡Siempre Listas para Servir!`;

    return { subject, body };
  };

  const handleCopyEmail = () => {
    const { body } = generateFormalEmailText();
    navigator.clipboard.writeText(body);
    setEmailCopied(true);
    setTimeout(() => setEmailCopied(false), 2000);
  };

  // Drag and Drop handlers
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  // File Parsing (supporting .csv, .xlsx, .xls, .pdf, .docx, .doc)
  const processFile = (file: File) => {
    setSelectedFile(file);
    setParsedRecords([]);
    setComparisonResults([]);
    setIsProcessing(true);

    const fileExtension = file.name.split(".").pop()?.toLowerCase();

    if (fileExtension === "csv") {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          const records = results.data.map((row) => mapRowToAffiliate(row));
          setParsedRecords(records);
          setIsProcessing(false);
        },
        error: (err) => {
          console.error("Error al leer el CSV:", err);
          setIsProcessing(false);
        }
      });
    } else if (fileExtension === "xlsx" || fileExtension === "xls") {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const bstr = e.target?.result;
          const wb = XLSX.read(bstr, { type: "binary" });
          const wsname = wb.SheetNames[0];
          const ws = wb.Sheets[wsname];
          const data = XLSX.utils.sheet_to_json(ws);
          
          const records = data.map((row) => mapRowToAffiliate(row));
          setParsedRecords(records);
          setIsProcessing(false);
        } catch (error) {
          console.error("Error al leer el archivo Excel:", error);
          setIsProcessing(false);
        }
      };
      reader.readAsBinaryString(file);
    } else if (fileExtension === "pdf") {
      readPdfText(file)
        .then((text) => {
          const records = parseRawTextToParticipants(text);
          setParsedRecords(records);
          setIsProcessing(false);
        })
        .catch((err) => {
          console.error("Error parsing PDF:", err);
          alert("Error al procesar el archivo PDF: " + err.message);
          setIsProcessing(false);
          setSelectedFile(null);
        });
    } else if (fileExtension === "docx") {
      readDocxText(file)
        .then((text) => {
          const records = parseRawTextToParticipants(text);
          setParsedRecords(records);
          setIsProcessing(false);
        })
        .catch((err) => {
          console.error("Error parsing DOCX:", err);
          alert("Error al procesar el archivo DOCX: " + err.message);
          setIsProcessing(false);
          setSelectedFile(null);
        });
    } else if (fileExtension === "doc") {
      file.text()
        .then((text) => {
          const cleanText = text.replace(/[^\x20-\x7E\s]/g, " "); // Basic cleanup
          const records = parseRawTextToParticipants(cleanText);
          setParsedRecords(records);
          setIsProcessing(false);
        })
        .catch((err) => {
          console.error("Error parsing DOC:", err);
          alert("Error al procesar el archivo DOC: " + err.message);
          setIsProcessing(false);
          setSelectedFile(null);
        });
    } else {
      alert("Por favor, suba un archivo con formato .csv, .xlsx, .pdf, .doc o .docx");
      setIsProcessing(false);
      setSelectedFile(null);
    }
  };

  // Run validation engine
  const handleValidate = () => {
    if (parsedRecords.length === 0) return;
    setIsProcessing(true);
    
    // Simulate slight lag for realistic processing indicator
    setTimeout(() => {
      const results = compareDataset(parsedRecords, referenceDB);
      setComparisonResults(results);
      setIsProcessing(false);
      setResultsPage(1);
    }, 800);
  };

  // Load demo CSV content
  const handleLoadDemo = () => {
    setParsedRecords([]);
    setComparisonResults([]);
    setIsProcessing(true);

    Papa.parse(demoCSVContent, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const records = results.data.map((row) => mapRowToAffiliate(row));
        setParsedRecords(records);
        setSelectedFile(new File([], "archivo_prueba_afiliaciones.csv"));
        setIsProcessing(false);
      }
    });
  };

  // Reset current validator state
  const handleClear = () => {
    setSelectedFile(null);
    setParsedRecords([]);
    setComparisonResults([]);
    setSearchQuery("");
    setStatusFilter("ALL");
  };

  // Add custom reference record to db
  const handleAddRefSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRefName || !newRefDni) return;

    const newRecord: AffiliateRecord = {
      nombre: newRefName,
      apellido: newRefLastName || undefined,
      dni: newRefDni,
      fechaNacimiento: newRefDate,
      tipoAfiliacion: newRefTipo,
      rama: newRefTipo === "SOCIA BENEFICIARIA" ? newRefRama : undefined
    };

    setReferenceDB(prev => {
      if (newRefTipo === "SOCIA VOLUNTARIAS") {
        return {
          ...prev,
          voluntarias: [...prev.voluntarias, newRecord]
        };
      } else {
        const ramaKey = newRefRama;
        const currentRamaList = prev.ramas[ramaKey] || [];
        return {
          ...prev,
          ramas: {
            ...prev.ramas,
            [ramaKey]: [...currentRamaList, newRecord]
          }
        };
      }
    });

    // Reset fields & close
    setNewRefName("");
    setNewRefLastName("");
    setNewRefDni("");
    setNewRefDate("");
    setShowAddRefModal(false);
  };

  // Delete reference record
  const handleDeleteRef = (dni: string, type: string, rama?: string) => {
    if(!window.confirm(`¿Está seguro de eliminar este afiliado de referencia con DNI ${dni}?`)) return;

    setReferenceDB(prev => {
      if (type === "SOCIA VOLUNTARIAS") {
        return {
          ...prev,
          voluntarias: prev.voluntarias.filter(r => r.dni !== dni)
        };
      } else if (rama) {
        return {
          ...prev,
          ramas: {
            ...prev.ramas,
            [rama]: prev.ramas[rama].filter(r => r.dni !== dni)
          }
        };
      }
      return prev;
    });
  };

  // Sync reference DB from Google Sheet ID
  const handleGoogleSync = (e: React.FormEvent) => {
    e.preventDefault();
    if (!googleSheetId) return;
    handleDownloadSheet(googleSheetId);
  };

  // Export results to CSV
  const handleExportCSV = () => {
    if (comparisonResults.length === 0) return;

    const dataToExport = comparisonResults.map((res) => ({
      "Nombre Input": res.record.nombre,
      "Apellido Input": res.record.apellido || "",
      "DNI Input": res.record.dni,
      "F. Nacimiento Input": res.record.fechaNacimiento,
      "Tipo Afiliacion Input": res.record.tipoAfiliacion,
      "Rama Input": res.record.rama || "",
      "Estado de Validacion": res.status,
      "Detalle Coincidencia": res.details,
      "Nombre Referencia Coincidente": res.matchedWith ? `${res.matchedWith.nombre} ${res.matchedWith.apellido || ""}` : "",
      "DNI Referencia Coincidente": res.matchedWith ? res.matchedWith.dni : ""
    }));

    const csv = Papa.unparse(dataToExport);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `resultados_validacion_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Counters for KPIs
  const kpis = {
    total: comparisonResults.length,
    matches: comparisonResults.filter((r) => r.status === "MATCH").length,
    mismatches: comparisonResults.filter((r) => r.status === "NO_MATCH").length,
    ramaMismatches: comparisonResults.filter((r) => r.status === "RAMA_MISMATCH").length,
    invalid: comparisonResults.filter((r) => r.status === "INVALID_DATA").length,
  };

  // Filter comparison results
  const filteredResults = comparisonResults.filter((res) => {
    const normSearch = searchQuery.toLowerCase();
    const fullName = `${res.record.nombre} ${res.record.apellido || ""}`.toLowerCase();
    const dni = res.record.dni.toLowerCase();
    
    const matchesSearch = fullName.includes(normSearch) || dni.includes(normSearch);
    
    if (statusFilter === "ALL") return matchesSearch;
    return res.status === statusFilter && matchesSearch;
  });

  // Pagination slice
  const paginatedResults = filteredResults.slice(
    (resultsPage - 1) * resultsPerPage,
    resultsPage * resultsPerPage
  );
  
  const totalResultsPages = Math.ceil(filteredResults.length / resultsPerPage);

  // Compile all reference DB records in a flat list for searching/exploring
  const allReferenceRecords: (AffiliateRecord & { sectionLabel: string })[] = [];
  
  referenceDB.voluntarias.forEach(r => {
    allReferenceRecords.push({ ...r, sectionLabel: "8.1 Voluntarias" });
  });
  
  (Object.entries(referenceDB.ramas) as [string, AffiliateRecord[]][]).forEach(([ramaName, list]) => {
    list.forEach(r => {
      allReferenceRecords.push({ ...r, sectionLabel: `Sección 8 - ${ramaName}` });
    });
  });

  const filteredReferenceRecords = allReferenceRecords.filter(r => {
    const normSearch = refSearch.toLowerCase();
    const fullName = `${r.nombre} ${r.apellido || ""}`.toLowerCase();
    const dni = r.dni.toLowerCase();
    const matchesSearch = fullName.includes(normSearch) || dni.includes(normSearch);

    if (refSectionFilter === "ALL") return matchesSearch;
    if (refSectionFilter === "VOLUNTARIAS") return r.tipoAfiliacion === "SOCIA VOLUNTARIAS" && matchesSearch;
    return r.rama === refSectionFilter && matchesSearch;
  });

  // Compile all parsed records for searching/exploring in "Información de Agnes"
  const allAgnesRecords = parsedRecords.map(r => {
    let sectionLabel = "";
    if (r.tipoAfiliacion === "SOCIA VOLUNTARIAS") {
      sectionLabel = "8.1 Voluntarias";
    } else {
      sectionLabel = r.rama ? `Sección 8 - ${r.rama}` : "Sección 8";
    }
    return { ...r, sectionLabel };
  });

  const filteredAgnesRecords = allAgnesRecords.filter(r => {
    const normSearch = refSearch.toLowerCase();
    const fullName = `${r.nombre} ${r.apellido || ""}`.toLowerCase();
    const dni = r.dni.toLowerCase();
    const matchesSearch = fullName.includes(normSearch) || dni.includes(normSearch);

    if (refSectionFilter === "ALL") return matchesSearch;
    if (refSectionFilter === "VOLUNTARIAS") return r.tipoAfiliacion === "SOCIA VOLUNTARIAS" && matchesSearch;
    return r.rama === refSectionFilter && matchesSearch;
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 font-sans">
      
      {/* Tab Selectors */}
      <div className="flex border-b border-brand-border mb-8 space-x-4">
        <button
          onClick={() => setActiveTab("validate")}
          className={`pb-4 text-sm font-semibold border-b-2 px-1 flex items-center space-x-2 transition-colors cursor-pointer ${
            activeTab === "validate"
              ? "border-brand-blue text-brand-blue"
              : "border-transparent text-brand-muted hover:text-brand-dark hover:border-gray-300"
          }`}
        >
          <FileCheck2 className="h-4 w-4" />
          <span>Validar Archivo de Entrada</span>
        </button>

        <button
          onClick={() => setActiveTab("reference")}
          className={`pb-4 text-sm font-semibold border-b-2 px-1 flex items-center space-x-2 transition-colors cursor-pointer ${
            activeTab === "reference"
              ? "border-brand-blue text-brand-blue"
              : "border-transparent text-brand-muted hover:text-brand-dark hover:border-gray-300"
          }`}
        >
          <Database className="h-4 w-4" />
          <span>Información de Agnes</span>
        </button>

        <button
          onClick={() => setActiveTab("sync")}
          className={`pb-4 text-sm font-semibold border-b-2 px-1 flex items-center space-x-2 transition-colors cursor-pointer ${
            activeTab === "sync"
              ? "border-brand-blue text-brand-blue"
              : "border-transparent text-brand-muted hover:text-brand-dark hover:border-gray-300"
          }`}
        >
          <Settings className="h-4 w-4" />
          <span>Sincronización Drive / Sheets</span>
        </button>
      </div>

      {/* ==================== TAB: VALIDATOR ==================== */}
      {activeTab === "validate" && (
        <div className="space-y-6">
          
          {/* Top Info Banner */}
          <div className="bg-brand-bg rounded-lg p-5 border border-brand-border flex items-start space-x-4">
            <Info className="h-5 w-5 text-brand-blue mt-0.5 shrink-0" />
            <div>
              <h3 className="font-bold text-brand-dark text-sm uppercase font-fredoka">Validar Archivo de Entrada contra Agnes</h3>
              <p className="text-xs text-brand-muted mt-1 leading-relaxed font-sans">
                Cargá la autorización de la actividad para verificar los datos de las participantes con el padrón base de Drive.
              </p>
              <p className="text-xs text-amber-700 font-medium mt-2 leading-relaxed font-sans">
                ⚠️ Antes de empezar: Asegurate de que el reporte de Sheets en Drive incluya las últimas actualizaciones y altas de las Comunidades en Agnes para garantizar una validación exacta.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Upload Zone & Setup Card */}
            <div className="lg:col-span-1 bg-white rounded-lg border border-brand-border shadow-sm p-6 flex flex-col justify-between">
              <div>
                <h3 className="text-base font-bold text-brand-dark uppercase border-b border-brand-border pb-3 mb-4 flex items-center font-fredoka">
                  <Upload className="h-5 w-5 text-brand-blue mr-2" />
                  Archivo de Entrada
                </h3>

                {/* Drag and Drop Container */}
                <div
                  onDragEnter={handleDrag}
                  onDragOver={handleDrag}
                  onDragLeave={handleDrag}
                  onDrop={handleDrop}
                  onClick={triggerFileInput}
                  className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-all duration-200 ${
                    dragActive 
                      ? "border-brand-blue bg-brand-bg" 
                      : selectedFile 
                        ? "border-emerald-300 bg-emerald-50/20 hover:bg-emerald-50/40" 
                        : "border-brand-border hover:border-brand-blue bg-brand-bg"
                  }`}
                >
                    <input
                      ref={fileInputRef}
                      type="file"
                      className="hidden"
                      accept=".csv, .xlsx, .xls, .pdf, .docx, .doc"
                      onChange={handleFileChange}
                    />
                    <div className="flex flex-col items-center">
                      {selectedFile ? (
                        <FileText className="h-10 w-10 text-emerald-600 mb-3" />
                      ) : (
                        <Upload className="h-10 w-10 text-brand-muted mb-3" />
                      )}
                      <span className="text-xs font-semibold text-brand-dark font-sans">
                        {selectedFile ? selectedFile.name : "Seleccione o arrastre su archivo"}
                      </span>
                      <span className="text-[10px] text-brand-muted mt-1 uppercase font-sans">
                        Soporta .csv, .xlsx, .xls, .pdf, .doc, .docx
                      </span>
                    </div>
                </div>

                {/* Quick actions inside upload card */}
                <div className="mt-4 flex flex-col space-y-2">
                  <button
                    onClick={handleLoadDemo}
                    className="w-full text-left px-3 py-2 bg-brand-bg border border-brand-border hover:bg-gray-100 rounded text-xs font-semibold text-brand-blue flex items-center justify-between cursor-pointer"
                  >
                    <span>Cargar archivo demo de prueba</span>
                    <ArrowRight className="h-3 w-3" />
                  </button>
                  {selectedFile && (
                    <button
                      onClick={handleClear}
                      className="w-full text-left px-3 py-2 text-xs font-semibold text-red-600 hover:bg-red-50 rounded flex items-center space-x-1 justify-center border border-dashed border-red-200 cursor-pointer"
                    >
                      <span>Quitar archivo actual</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Validation Trigger Button */}
              <div className="mt-8 pt-4 border-t border-brand-border">
                <button
                  onClick={handleValidate}
                  disabled={parsedRecords.length === 0 || isProcessing}
                  className={`w-full flex items-center justify-center py-2.5 px-4 rounded font-sans font-bold text-sm uppercase tracking-wider text-white transition-opacity cursor-pointer ${
                    parsedRecords.length === 0 || isProcessing
                      ? "bg-gray-300 cursor-not-allowed"
                      : "bg-brand-blue hover:opacity-90"
                  }`}
                >
                  {isProcessing ? (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      Procesando...
                    </>
                  ) : (
                    <>
                      <FileCheck2 className="h-4 w-4 mr-2" />
                      Validar Afiliaciones
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Main Validation Results / Status Panel */}
            <div className="lg:col-span-2 space-y-6">
              
              {/* If no file uploaded */}
              {!selectedFile && (
                <div className="bg-white border border-brand-border rounded-lg p-12 text-center shadow-sm">
                  <Layers className="h-12 w-12 text-brand-muted mx-auto mb-4" />
                  <h4 className="text-base font-bold text-brand-dark uppercase font-fredoka">No hay datos cargados</h4>
                  <p className="text-xs text-brand-muted mt-2 font-sans max-w-sm mx-auto leading-relaxed">
                    Por favor, cargue un archivo de entrada o utilice la base de afiliados de prueba para iniciar la simulación de comparación.
                  </p>
                </div>
              )}

              {/* If file uploaded but not yet validated */}
              {selectedFile && comparisonResults.length === 0 && (
                <div className="bg-white border border-brand-border rounded-lg p-8 shadow-sm">
                  <h3 className="text-sm font-bold text-brand-dark uppercase border-b border-brand-border pb-3 mb-4">
                    Resumen del Archivo Cargado
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
                    <div className="bg-brand-bg rounded-md p-4 border border-brand-border text-center">
                      <p className="text-[10px] text-brand-muted uppercase font-bold">Registros Detectados</p>
                      <p className="text-2xl font-extrabold text-brand-blue mt-1">{parsedRecords.length}</p>
                    </div>
                    <div className="bg-brand-bg rounded-md p-4 border border-brand-border text-center">
                      <p className="text-[10px] text-brand-muted uppercase font-bold">Nombre del Archivo</p>
                      <p className="text-xs font-bold text-brand-dark mt-2 truncate max-w-full px-2" title={selectedFile.name}>
                        {selectedFile.name}
                      </p>
                    </div>
                    <div className="bg-brand-bg rounded-md p-4 border border-brand-border text-center">
                      <p className="text-[10px] text-brand-muted uppercase font-bold">Origen de Datos</p>
                      <p className="text-xs font-bold text-emerald-600 mt-2 flex items-center justify-center space-x-1">
                        <Database className="h-3 w-3" />
                        <span>Referencia local</span>
                      </p>
                    </div>
                  </div>
                  <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded-r-md flex items-start space-x-3">
                    <HelpCircle className="h-5 w-5 text-blue-500 shrink-0 mt-0.5" />
                    <p className="text-xs text-blue-800 leading-relaxed">
                      El archivo se cargó correctamente en el navegador de forma segura. Haga clic en el botón <strong>"Validar Afiliaciones"</strong> a la izquierda para procesar y cotejar la información contra la base de datos de referencia.
                    </p>
                  </div>
                </div>
              )}

              {/* If results available */}
              {comparisonResults.length > 0 && (
                <div className="space-y-6">
                  
                  {/* Bento Grid Metrics */}
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                    <div className="bg-white border border-brand-border rounded-lg p-3 text-center shadow-sm">
                      <p className="text-[9px] text-brand-muted uppercase font-bold tracking-wider font-sans">Procesados</p>
                      <p className="text-xl font-extrabold text-brand-dark mt-1 font-sans">{kpis.total}</p>
                    </div>
                    
                    <div className="bg-emerald-50/50 border border-emerald-100 rounded-lg p-3 text-center shadow-sm">
                      <p className="text-[9px] text-emerald-600 uppercase font-bold tracking-wider font-sans">Correctos</p>
                      <div className="flex items-center justify-center space-x-1 mt-1">
                        <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                        <span className="text-xl font-extrabold text-emerald-700 font-sans">{kpis.matches}</span>
                      </div>
                    </div>

                    <div className="bg-amber-50/50 border border-amber-100 rounded-lg p-3 text-center shadow-sm">
                      <p className="text-[9px] text-amber-600 uppercase font-bold tracking-wider font-sans">Rama Incorrecta</p>
                      <div className="flex items-center justify-center space-x-1 mt-1">
                        <AlertTriangle className="h-4 w-4 text-amber-600" />
                        <span className="text-xl font-extrabold text-amber-700 font-sans">{kpis.ramaMismatches}</span>
                      </div>
                    </div>

                    <div className="bg-red-50/50 border border-red-100 rounded-lg p-3 text-center shadow-sm">
                      <p className="text-[9px] text-red-600 uppercase font-bold tracking-wider font-sans">Sin Coincidencia</p>
                      <div className="flex items-center justify-center space-x-1 mt-1">
                        <XCircle className="h-4 w-4 text-red-600" />
                        <span className="text-xl font-extrabold text-red-700 font-sans">{kpis.mismatches}</span>
                      </div>
                    </div>

                    <div className="bg-gray-50 border border-brand-border rounded-lg p-3 text-center shadow-sm">
                      <p className="text-[9px] text-brand-muted uppercase font-bold tracking-wider font-sans">Datos Inválidos</p>
                      <div className="flex items-center justify-center space-x-1 mt-1">
                        <ShieldAlert className="h-4 w-4 text-brand-muted" />
                        <span className="text-xl font-extrabold text-brand-dark font-sans">{kpis.invalid}</span>
                      </div>
                    </div>
                  </div>

                  {/* Results Filter & Table Card */}
                  <div className="bg-white border border-brand-border rounded-lg shadow-sm">
                    
                    {/* Header with Search and Export */}
                    <div className="p-4 border-b border-brand-border flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                      <div className="flex items-center space-x-3 flex-1">
                        <div className="relative flex-1 max-w-xs">
                          <input
                            type="text"
                            placeholder="Buscar por Nombre o DNI..."
                            value={searchQuery}
                            onChange={(e) => {
                              setSearchQuery(e.target.value);
                              setResultsPage(1);
                            }}
                            className="w-full pl-9 pr-3 py-1.5 border border-brand-border rounded-md text-xs focus:outline-none focus:ring-brand-blue focus:border-brand-blue font-sans text-brand-dark bg-brand-bg placeholder-gray-400"
                          />
                          <Search className="h-4 w-4 text-brand-muted absolute left-3 top-2" />
                        </div>

                        {/* Status filter dropdown */}
                        <div className="flex items-center space-x-1">
                          <Filter className="h-3 w-3 text-brand-muted" />
                          <select
                            value={statusFilter}
                            onChange={(e) => {
                              setStatusFilter(e.target.value);
                              setResultsPage(1);
                            }}
                            className="border border-brand-border bg-brand-bg rounded-md py-1 px-2 text-xs focus:outline-none focus:ring-brand-blue focus:border-brand-blue font-sans text-brand-dark"
                          >
                            <option value="ALL">Todos los Estados</option>
                            <option value="MATCH">Coincidencia</option>
                            <option value="RAMA_MISMATCH">Rama Incorrecta</option>
                            <option value="NO_MATCH">Sin Coincidencia</option>
                            <option value="INVALID_DATA">Datos Inválidos</option>
                          </select>
                        </div>
                      </div>

                      <button
                        onClick={handleExportCSV}
                        className="bg-brand-blue hover:opacity-90 text-white px-3 py-1.5 rounded text-xs font-bold uppercase tracking-wider flex items-center justify-center space-x-1 cursor-pointer transition-opacity"
                      >
                        <Download className="h-3.5 w-3.5" />
                        <span>Exportar Resultados</span>
                      </button>
                    </div>

                    {/* Results Table */}
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-brand-border">
                        <thead className="bg-brand-bg">
                          <tr>
                            <th className="px-4 py-3 text-left text-[10px] font-bold text-brand-muted uppercase tracking-wider font-sans">Afiliado (Input)</th>
                            <th className="px-4 py-3 text-left text-[10px] font-bold text-brand-muted uppercase tracking-wider font-sans">DNI</th>
                            <th className="px-4 py-3 text-left text-[10px] font-bold text-brand-muted uppercase tracking-wider font-sans">F. Nacimiento</th>
                            <th className="px-4 py-3 text-left text-[10px] font-bold text-brand-muted uppercase tracking-wider font-sans">Tipo/Rama</th>
                            <th className="px-4 py-3 text-left text-[10px] font-bold text-brand-muted uppercase tracking-wider font-sans">Validación</th>
                            <th className="px-4 py-3 text-left text-[10px] font-bold text-brand-muted uppercase tracking-wider font-sans">Detalles del Resultado</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-brand-border text-xs">
                          {paginatedResults.length === 0 ? (
                            <tr>
                              <td colSpan={6} className="px-4 py-8 text-center text-brand-muted font-sans">
                                Ningún resultado coincide con los filtros aplicados.
                              </td>
                            </tr>
                          ) : (
                            paginatedResults.map((res) => (
                              <tr key={res.id} className="hover:bg-brand-bg transition-colors">
                                <td className="px-4 py-3 whitespace-nowrap font-bold text-brand-dark">
                                  {res.record.nombre} {res.record.apellido || ""}
                                </td>
                                <td className="px-4 py-3 whitespace-nowrap text-brand-dark font-mono">
                                  {res.record.dni || <span className="text-red-400 font-sans italic">Falta</span>}
                                </td>
                                <td className="px-4 py-3 whitespace-nowrap text-brand-muted">
                                  {res.record.fechaNacimiento || <span className="text-red-400 italic">Falta</span>}
                                </td>
                                <td className="px-4 py-3 whitespace-nowrap text-brand-dark">
                                  <div className="font-extrabold text-[9px] uppercase text-brand-muted">{res.record.tipoAfiliacion}</div>
                                  <div className="text-[10px] text-brand-blue font-bold">{res.record.rama || "Sin Rama"}</div>
                                </td>
                                <td className="px-4 py-3 whitespace-nowrap">
                                  {res.status === "MATCH" && (
                                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                                      Coincidencia
                                    </span>
                                  )}
                                  {res.status === "RAMA_MISMATCH" && (
                                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800">
                                      Rama Incorrecta
                                    </span>
                                  )}
                                  {res.status === "NO_MATCH" && (
                                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-800">
                                      Sin Registro
                                    </span>
                                  )}
                                  {res.status === "INVALID_DATA" && (
                                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-gray-100 text-brand-muted">
                                      Faltan Datos
                                    </span>
                                  )}
                                </td>
                                <td className="px-4 py-3 text-brand-muted font-sans max-w-xs truncate" title={res.details}>
                                  {res.details}
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>

                    {/* Pagination Controls */}
                    {totalResultsPages > 1 && (
                      <div className="px-4 py-3 border-t border-brand-border flex items-center justify-between">
                        <span className="text-xs text-brand-muted font-sans">
                          Mostrando página <strong>{resultsPage}</strong> de <strong>{totalResultsPages}</strong> (Filtrados: {filteredResults.length} registros)
                        </span>
                        <div className="flex space-x-2">
                          <button
                            onClick={() => setResultsPage(prev => Math.max(prev - 1, 1))}
                            disabled={resultsPage === 1}
                            className={`px-3 py-1 border border-brand-border rounded text-xs font-semibold cursor-pointer ${
                              resultsPage === 1 ? "text-gray-300 cursor-not-allowed" : "text-brand-dark hover:bg-brand-bg"
                            }`}
                          >
                            Anterior
                          </button>
                          <button
                            onClick={() => setResultsPage(prev => Math.min(prev + 1, totalResultsPages))}
                            disabled={resultsPage === totalResultsPages}
                            className={`px-3 py-1 border border-brand-border rounded text-xs font-semibold cursor-pointer ${
                              resultsPage === totalResultsPages ? "text-gray-300 cursor-not-allowed" : "text-brand-dark hover:bg-brand-bg"
                            }`}
                          >
                            Siguiente
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Email Draft Generator Card */}
                  <div className="bg-white border border-brand-border rounded-lg shadow-sm overflow-hidden">
                    <div className="bg-brand-bg px-4 py-3 border-b border-brand-border flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <Mail className="h-4 w-4 text-brand-blue" />
                        <h4 className="text-xs font-bold text-brand-dark uppercase font-fredoka tracking-wide">
                          Reporte de Observaciones & Correo Formal
                        </h4>
                      </div>
                      <button
                        onClick={handleCopyEmail}
                        className="bg-brand-blue hover:bg-brand-blue/90 text-white text-[11px] font-bold py-1 px-3 rounded flex items-center space-x-1 cursor-pointer transition-colors"
                      >
                        {emailCopied ? (
                          <>
                            <Check className="h-3.5 w-3.5" />
                            <span>¡Copiado!</span>
                          </>
                        ) : (
                          <>
                            <Copy className="h-3.5 w-3.5" />
                            <span>Copiar Correo</span>
                          </>
                        )}
                      </button>
                    </div>
                    <div className="p-4 space-y-3">
                      <div className="text-xs space-y-1">
                        <div className="flex border-b border-brand-border/60 pb-1.5">
                          <span className="font-bold text-brand-muted w-16 shrink-0 font-sans">Para:</span>
                          <span className="text-brand-dark font-sans">coordinacion.campamentos@aga.org.ar</span>
                        </div>
                        <div className="flex border-b border-brand-border/60 pb-1.5">
                          <span className="font-bold text-brand-muted w-16 shrink-0 font-sans">De:</span>
                          <span className="text-brand-dark font-sans">auditoria.datos@aga.org.ar</span>
                        </div>
                        <div className="flex border-b border-brand-border/60 pb-1.5">
                          <span className="font-bold text-brand-muted w-16 shrink-0 font-sans">Asunto:</span>
                          <span className="text-brand-dark font-sans font-bold">{generateFormalEmailText().subject}</span>
                        </div>
                      </div>
                      <div className="bg-brand-bg/40 p-4 border border-brand-border rounded-md text-xs font-mono text-brand-dark whitespace-pre-wrap max-h-[300px] overflow-y-auto leading-relaxed">
                        {generateFormalEmailText().body}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ==================== TAB: REFERENCE DB EXPLORER ==================== */}
      {activeTab === "reference" && (
        <div className="space-y-6">
          <div className="bg-white border border-brand-border rounded-lg shadow-sm p-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-brand-border pb-4 mb-6 gap-3">
              <div>
                <h3 className="text-base font-bold text-brand-dark uppercase font-fredoka">Información de Agnes</h3>
                <p className="text-xs text-brand-muted mt-1 font-sans">
                  Visualice y explore la información del archivo de entrada que se ha cargado en el sistema de manera segura.
                </p>
              </div>
            </div>

            {/* Reference DB Filters */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
              <div className="relative">
                <input
                  type="text"
                  placeholder="Buscar por Nombre o DNI..."
                  value={refSearch}
                  onChange={(e) => setRefSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 border border-brand-border bg-brand-bg rounded-md text-xs focus:outline-none focus:ring-brand-blue focus:border-brand-blue font-sans text-brand-dark placeholder-gray-400"
                />
                <Search className="h-4 w-4 text-brand-muted absolute left-3 top-2" />
              </div>

              <div>
                <select
                  value={refSectionFilter}
                  onChange={(e) => setRefSectionFilter(e.target.value)}
                  className="w-full border border-brand-border bg-brand-bg rounded-md py-1.5 px-3 text-xs focus:outline-none focus:ring-brand-blue focus:border-brand-blue font-sans text-brand-dark"
                >
                  <option value="ALL">Todas las Secciones</option>
                  <option value="VOLUNTARIAS">Sección 8.1 Voluntarias</option>
                  {Object.keys(referenceDB.ramas).map((ramaKey) => (
                    <option key={ramaKey} value={ramaKey}>Sección 8 - {ramaKey}</option>
                  ))}
                </select>
              </div>

              <div className="flex items-center text-xs text-brand-muted font-sans sm:justify-end">
                <span>Total Archivo: {allAgnesRecords.length} registros</span>
              </div>
            </div>

            {/* Reference DB Grid/Table */}
            <div className="overflow-x-auto rounded-lg border border-brand-border">
              <table className="min-w-full divide-y divide-brand-border">
                <thead className="bg-brand-bg">
                  <tr>
                    <th className="px-4 py-3 text-left text-[10px] font-bold text-brand-muted uppercase tracking-wider font-sans">Nombre / Apellido</th>
                    <th className="px-4 py-3 text-left text-[10px] font-bold text-brand-muted uppercase tracking-wider font-sans">DNI</th>
                    <th className="px-4 py-3 text-left text-[10px] font-bold text-brand-muted uppercase tracking-wider font-sans">Fecha Nacimiento</th>
                    <th className="px-4 py-3 text-left text-[10px] font-bold text-brand-muted uppercase tracking-wider font-sans">Sección Asociada</th>
                    <th className="px-4 py-3 text-left text-[10px] font-bold text-brand-muted uppercase tracking-wider font-sans">Tipo Afiliación</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-brand-border text-xs">
                  {filteredAgnesRecords.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-brand-muted font-sans">
                        No se encontraron registros de Agnes cargados en el archivo. Por favor suba un archivo en la pestaña "Validar Archivo de Entrada".
                      </td>
                    </tr>
                  ) : (
                    filteredAgnesRecords.map((r, index) => (
                      <tr key={`${r.dni}-${index}`} className="hover:bg-brand-bg transition-colors">
                        <td className="px-4 py-3 whitespace-nowrap font-bold text-brand-dark">
                          {r.nombre} {r.apellido || ""}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap font-mono text-brand-dark">{r.dni}</td>
                        <td className="px-4 py-3 whitespace-nowrap text-brand-muted">{r.fechaNacimiento}</td>
                        <td className="px-4 py-3 whitespace-nowrap text-brand-blue font-bold">{r.sectionLabel}</td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-[9px] font-bold uppercase ${
                            r.tipoAfiliacion === "SOCIA VOLUNTARIAS" ? "bg-purple-100 text-purple-800" : "bg-blue-100 text-blue-800"
                          }`}>
                            {r.tipoAfiliacion}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ==================== TAB: DRIVE / SHEETS SYNC ==================== */}
      {activeTab === "sync" && (
        <div className="space-y-6 max-w-2xl mx-auto">
          {/* Connection Status Card */}
          <div className="bg-white border border-brand-border rounded-lg shadow-sm p-6">
            <h3 className="text-base font-bold text-brand-dark uppercase border-b border-brand-border pb-3 mb-4 flex items-center font-sans">
              <Layers className="h-5 w-5 text-brand-blue mr-2" />
              Sincronización con Google Drive / Sheets
            </h3>

            <p className="text-xs text-brand-muted leading-relaxed mb-6 font-sans">
              Para validar las afiliaciones contra el padrón de referencia oficial en tiempo real, conecte su cuenta de Google. Esto permitirá que el sistema lea la base de datos directamente desde sus hojas de cálculo de Google Drive.
            </p>

            {!googleUser ? (
              <div className="bg-brand-bg rounded-lg p-8 border border-dashed border-brand-border text-center flex flex-col items-center">
                <Database className="h-10 w-10 text-brand-muted mb-3" />
                <h4 className="text-xs font-bold text-brand-dark uppercase tracking-wider mb-2">Conexión de Cuenta de Google Requerida</h4>
                <p className="text-xs text-brand-muted max-w-md mb-6 leading-relaxed">
                  Para acceder a sus hojas de cálculo de Sheets de manera directa, inicie sesión de forma segura utilizando Google OAuth 2.0. Sus datos nunca salen de su navegador.
                </p>
                <button
                  onClick={handleGoogleLogin}
                  disabled={syncLoading}
                  className="bg-white hover:bg-gray-50 text-gray-700 font-bold text-xs py-2 px-4 border border-gray-300 rounded shadow-sm flex items-center space-x-3 cursor-pointer transition-colors"
                >
                  <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" width="100%" height="100%">
                    <path fill="#EA4335" d="M12 5.04c1.65 0 3.13.57 4.3 1.69l3.21-3.21C17.56 1.83 14.99 1 12 1 7.35 1 3.41 3.67 1.48 7.56l3.87 3a6.99 6.99 0 0 1 6.65-5.52z"/>
                    <path fill="#4285F4" d="M23.49 12.27c0-.81-.07-1.59-.2-2.35H12v4.51h6.43a5.52 5.52 0 0 1-2.4 3.63l3.72 2.89c2.18-2 3.74-4.96 3.74-8.68z"/>
                    <path fill="#FBBC05" d="M5.35 14.56A7.05 7.05 0 0 1 5 12c0-.89.15-1.74.43-2.54l-3.87-3A11.95 11.95 0 0 0 0 12c0 2.01.5 3.91 1.4 5.61l3.95-3.05z"/>
                    <path fill="#34A853" d="M12 23c3.24 0 5.97-1.07 7.96-2.91l-3.72-2.89a6.98 6.98 0 0 1-4.24 1.2c-3.66 0-6.77-2.47-7.88-5.8l-3.95 3.05C2.18 19.89 6.7 23 12 23z"/>
                  </svg>
                  <span>Iniciar Sesión con Google</span>
                </button>
              </div>
            ) : (
              <div className="bg-brand-bg rounded-lg p-4 border border-brand-border flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="flex items-center space-x-3">
                  {googleUser.photoURL ? (
                    <img src={googleUser.photoURL} alt={googleUser.displayName} referrerPolicy="no-referrer" className="h-10 w-10 rounded-full border border-brand-border" />
                  ) : (
                    <div className="h-10 w-10 rounded-full bg-brand-blue text-white flex items-center justify-center font-bold text-sm">
                      {googleUser.displayName?.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div>
                    <h4 className="text-xs font-bold text-brand-dark uppercase tracking-wider">{googleUser.displayName}</h4>
                    <p className="text-[10px] text-brand-muted">{googleUser.email}</p>
                  </div>
                </div>
                <button
                  onClick={handleGoogleLogout}
                  className="px-3 py-1.5 border border-red-200 hover:bg-red-50 text-red-600 rounded text-xs font-semibold cursor-pointer transition-colors uppercase tracking-wider"
                >
                  Cerrar Sesión Google
                </button>
              </div>
            )}
          </div>

          {/* Configuration and Sync console */}
          {googleUser && (
            <div className="bg-white border border-brand-border rounded-lg shadow-sm p-6 space-y-4">
              <h4 className="text-xs font-bold text-brand-dark uppercase tracking-wider border-b border-brand-border pb-2 flex items-center">
                <Settings className="h-4 w-4 text-brand-blue mr-1.5" />
                Consola de Sincronización
              </h4>

              {/* Spreadsheets selector from Google Drive */}
              <div>
                <label className="block text-xs font-bold text-brand-muted uppercase font-sans mb-1 tracking-wider">
                  Seleccionar Planilla desde su Google Drive
                </label>
                {googleSpreadsheets.length > 0 ? (
                  <select
                    onChange={(e) => setGoogleSheetId(e.target.value)}
                    value={googleSheetId}
                    className="w-full border border-brand-border bg-brand-bg rounded-md py-1.5 px-3 text-xs focus:outline-none focus:ring-brand-blue focus:border-brand-blue font-sans text-brand-dark"
                  >
                    <option value="">-- Seleccione una planilla encontrada --</option>
                    {googleSpreadsheets.map((sheet) => (
                      <option key={sheet.id} value={sheet.id}>
                        {sheet.name}
                      </option>
                    ))}
                  </select>
                ) : (
                  <p className="text-[10px] text-brand-muted italic bg-brand-bg p-2 rounded-md border border-brand-border">
                    No se encontraron hojas de cálculo creadas en la cuenta conectada, o cargando archivos...
                  </p>
                )}
              </div>

              {/* Raw ID Field Input */}
              <div>
                <label className="block text-xs font-bold text-brand-muted uppercase font-sans mb-1 tracking-wider">
                  ID de la Planilla Google Sheets (Manual)
                </label>
                <input
                  type="text"
                  required
                  value={googleSheetId}
                  onChange={(e) => setGoogleSheetId(e.target.value)}
                  placeholder="Ej: 1szYm-Y0l07lV_XmS2xP0b_b25AunXgO8HjZ99h_v6s"
                  className="w-full px-3 py-2 border border-brand-border bg-brand-bg rounded-md text-xs font-mono focus:outline-none focus:ring-brand-blue focus:border-brand-blue text-brand-dark"
                />
                <p className="text-[10px] text-brand-muted mt-1 font-sans leading-relaxed">
                  El ID se extrae de la URL de su hoja de cálculo: docs.google.com/spreadsheets/d/<strong>[ID-DE-LA-PLANILLA]</strong>/edit
                </p>
              </div>

              {/* Requirement structure warning */}
              <div className="bg-brand-bg rounded-md p-4 border border-brand-border space-y-2">
                <p className="text-xs font-bold text-brand-blue uppercase flex items-center font-sans">
                  <Info className="h-4 w-4 mr-1 shrink-0" />
                  Estructura Requerida del Archivo:
                </p>
                <ul className="list-disc list-inside text-[10px] text-brand-muted space-y-1 pl-1 font-sans">
                  <li>Debe tener una pestaña llamada exactamente <strong className="text-brand-dark">"Datos"</strong>.</li>
                  <li>Columnas obligatorias en la pestaña: <strong className="text-brand-dark">'TipoAfiliacion', 'Rama', 'Nombres', 'Apellidos', 'NroDocumento'</strong> y <strong className="text-brand-dark">'FechaNacimiento'</strong>.</li>
                  <li>Las columnas son independientes del orden e insensibles a mayúsculas/minúsculas.</li>
                </ul>
              </div>

              {/* Real-time status alert message */}
              {syncStatusMsg && (
                <div className={`p-4 rounded-md border-l-4 ${
                  syncStatusMsg.type === "success" 
                    ? "bg-emerald-50 border-emerald-500 text-emerald-800" 
                    : syncStatusMsg.type === "error"
                      ? "bg-red-50 border-red-500 text-red-800"
                      : "bg-blue-50 border-blue-500 text-blue-800"
                }`}>
                  <div className="flex">
                    {syncStatusMsg.type === "success" ? (
                      <CheckCircle2 className="h-5 w-5 mr-2 shrink-0" />
                    ) : syncStatusMsg.type === "error" ? (
                      <XCircle className="h-5 w-5 mr-2 shrink-0" />
                    ) : (
                      <Info className="h-5 w-5 mr-2 shrink-0" />
                    )}
                    <span className="text-xs font-sans font-bold leading-relaxed">{syncStatusMsg.text}</span>
                  </div>
                </div>
              )}

              {/* Sync Trigger button */}
              <button
                onClick={() => handleDownloadSheet(googleSheetId)}
                disabled={syncLoading || !googleSheetId}
                className={`w-full py-2.5 px-4 rounded text-xs font-bold uppercase tracking-wider text-white transition-opacity flex items-center justify-center space-x-1.5 cursor-pointer ${
                  syncLoading || !googleSheetId 
                    ? "bg-gray-300 cursor-not-allowed" 
                    : "bg-brand-blue hover:opacity-90"
                }`}
              >
                {syncLoading ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    <span>Sincronizando con Google...</span>
                  </>
                ) : (
                  <>
                    <RefreshCw className="h-4 w-4" />
                    <span>Sincronizar Padrón de Referencia</span>
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      )}

      {/* ==================== MODAL: ADD REFERENCE RECORD ==================== */}
      {showAddRefModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl border border-brand-border max-w-md w-full p-6">
            <h3 className="text-sm font-bold text-brand-dark uppercase border-b border-brand-border pb-3 mb-4 font-sans tracking-wide">
              Agregar Afiliado de Referencia
            </h3>
            
            <form onSubmit={handleAddRefSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-brand-muted uppercase mb-1 font-sans">Nombre</label>
                  <input
                    type="text"
                    required
                    value={newRefName}
                    onChange={(e) => setNewRefName(e.target.value)}
                    placeholder="Ej: Juana"
                    className="w-full px-3 py-1.5 border border-brand-border bg-brand-bg rounded-md text-xs focus:outline-none focus:ring-brand-blue focus:border-brand-blue text-brand-dark font-sans"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-brand-muted uppercase mb-1 font-sans">Apellido</label>
                  <input
                    type="text"
                    value={newRefLastName}
                    onChange={(e) => setNewRefLastName(e.target.value)}
                    placeholder="Ej: Pérez"
                    className="w-full px-3 py-1.5 border border-brand-border bg-brand-bg rounded-md text-xs focus:outline-none focus:ring-brand-blue focus:border-brand-blue text-brand-dark font-sans"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-brand-muted uppercase mb-1 font-sans">DNI</label>
                  <input
                    type="text"
                    required
                    value={newRefDni}
                    onChange={(e) => setNewRefDni(e.target.value)}
                    placeholder="Ej: 25678901"
                    className="w-full px-3 py-1.5 border border-brand-border bg-brand-bg rounded-md text-xs focus:outline-none focus:ring-brand-blue focus:border-brand-blue text-brand-dark font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-brand-muted uppercase mb-1 font-sans">Fecha Nacimiento</label>
                  <input
                    type="date"
                    required
                    value={newRefDate}
                    onChange={(e) => setNewRefDate(e.target.value)}
                    className="w-full px-3 py-1.5 border border-brand-border bg-brand-bg rounded-md text-xs focus:outline-none focus:ring-brand-blue focus:border-brand-blue text-brand-dark font-sans"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-brand-muted uppercase mb-1 font-sans">Tipo de Afiliación de Referencia</label>
                <select
                  value={newRefTipo}
                  onChange={(e) => setNewRefTipo(e.target.value)}
                  className="w-full border border-brand-border bg-brand-bg rounded-md py-1.5 px-3 text-xs focus:outline-none focus:ring-brand-blue focus:border-brand-blue text-brand-dark font-sans"
                >
                  <option value="SOCIA BENEFICIARIA">SOCIA BENEFICIARIA (Sección 8)</option>
                  <option value="SOCIA VOLUNTARIAS">SOCIA VOLUNTARIAS (Sección 8.1)</option>
                </select>
              </div>

              {newRefTipo === "SOCIA BENEFICIARIA" && (
                <div>
                  <label className="block text-[10px] font-bold text-brand-muted uppercase mb-1 font-sans">Rama de Actividad</label>
                  <select
                    value={newRefRama}
                    onChange={(e) => setNewRefRama(e.target.value)}
                    className="w-full border border-brand-border bg-brand-bg rounded-md py-1.5 px-3 text-xs focus:outline-none focus:ring-brand-blue focus:border-brand-blue text-brand-dark font-sans"
                  >
                    <option value="Rama Textil">Rama Textil</option>
                    <option value="Rama Cartonera">Rama Cartonera</option>
                    <option value="Rama Sociocomunitaria">Rama Sociocomunitaria</option>
                  </select>
                </div>
              )}

              <div className="flex space-x-3 pt-4 border-t border-brand-border">
                <button
                  type="button"
                  onClick={() => setShowAddRefModal(false)}
                  className="w-1/2 bg-brand-bg border border-brand-border text-brand-dark py-2 rounded text-xs font-bold uppercase cursor-pointer hover:bg-gray-200 transition-colors font-sans"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="w-1/2 bg-brand-blue hover:opacity-90 text-white py-2 rounded text-xs font-bold uppercase cursor-pointer transition-opacity font-sans"
                >
                  Guardar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
