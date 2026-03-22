import * as XLSX from 'xlsx';
import {
  collection,
  doc,
  writeBatch,
  Timestamp,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type {
  RGExcelRow,
  RGPreviewRow,
  RGImportError,
  RGImportResult,
} from '@/types/registro-geografico';
import { updateRegistryMeta } from '@/services/rgService';

// ─── Column name normalizer ───────────────────────────────────

const COLUMN_MAP: Record<string, keyof RGExcelRow> = {
  bairro: 'bairro',
  neighborhood: 'bairro',
  district: 'bairro',
  logradouro: 'logradouro',
  rua: 'logradouro',
  街street: 'logradouro',
  street: 'logradouro',
  endereco: 'logradouro',
  endereço: 'logradouro',
  'número': 'numero',
  numero: 'numero',
  num: 'numero',
  'nº': 'numero',
  number: 'numero',
  house: 'numero',
  cidade: 'cidade',
  city: 'cidade',
  municipio: 'cidade',
  município: 'cidade',
  uf: 'uf',
  estado: 'uf',
  state: 'uf',
  cep: 'cep',
  zip: 'cep',
  'cód.postal': 'cep',
  'cod.postal': 'cep',
};

function normalizeHeader(h: string): string {
  return h
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9.º]/g, '')
    .trim();
}

function detectColumns(headers: string[]): Record<keyof RGExcelRow, number> | null {
  const result: Partial<Record<keyof RGExcelRow, number>> = {};
  headers.forEach((h, idx) => {
    const normalized = normalizeHeader(h);
    const mapped = COLUMN_MAP[normalized];
    if (mapped && !(mapped in result)) {
      result[mapped] = idx;
    }
  });

  const required: Array<keyof RGExcelRow> = ['bairro', 'logradouro', 'numero', 'cidade', 'uf'];
  for (const r of required) {
    if (result[r] === undefined) return null;
  }

  return result as Record<keyof RGExcelRow, number>;
}

// ─── Parse ───────────────────────────────────────────────────

export function parseExcelFile(file: File): Promise<{ rows: RGExcelRow[]; rawHeaders: string[] }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target!.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1, defval: '' });

        if (jsonData.length < 2) {
          reject(new Error('Planilha vazia ou sem dados'));
          return;
        }

        const rawHeaders = (jsonData[0] as string[]).map((h) => String(h ?? '').trim());
        const colMap = detectColumns(rawHeaders);

        if (!colMap) {
          reject(
            new Error(
              'Colunas obrigatórias não encontradas. Necessário: Bairro, Logradouro, Número, Cidade, UF'
            )
          );
          return;
        }

        const rows: RGExcelRow[] = [];
        for (let i = 1; i < jsonData.length; i++) {
          const row = jsonData[i] as string[];
          const bairro = String(row[colMap.bairro] ?? '').trim();
          const logradouro = String(row[colMap.logradouro] ?? '').trim();
          const numero = String(row[colMap.numero] ?? '').trim();
          const cidade = String(row[colMap.cidade] ?? '').trim();
          const uf = String(row[colMap.uf] ?? '').trim();
          const cep = colMap.cep !== undefined ? String(row[colMap.cep] ?? '').trim() : undefined;

          // Skip completely empty rows
          if (!bairro && !logradouro && !numero) continue;

          rows.push({ bairro, logradouro, numero, cidade, uf, cep });
        }

        resolve({ rows, rawHeaders });
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(new Error('Erro ao ler arquivo'));
    reader.readAsArrayBuffer(file);
  });
}

// ─── Validate ────────────────────────────────────────────────

export function validateRows(rows: RGExcelRow[]): RGPreviewRow[] {
  return rows.map((row, idx) => {
    const errors: RGImportError[] = [];
    const rowIndex = idx + 2; // 1-indexed + skip header

    if (!row.bairro) errors.push({ row: rowIndex, field: 'bairro', message: 'Bairro obrigatório' });
    if (!row.logradouro) errors.push({ row: rowIndex, field: 'logradouro', message: 'Logradouro obrigatório' });
    if (!row.numero) errors.push({ row: rowIndex, field: 'numero', message: 'Número obrigatório' });
    if (!row.cidade) errors.push({ row: rowIndex, field: 'cidade', message: 'Cidade obrigatória' });
    if (!row.uf || row.uf.length !== 2) {
      errors.push({ row: rowIndex, field: 'uf', message: 'UF inválida (deve ter 2 caracteres)' });
    }

    return { ...row, rowIndex, errors, isValid: errors.length === 0 };
  });
}

// ─── Derive Blocks ───────────────────────────────────────────

export function deriveBlocks(rows: RGExcelRow[]): Map<string, RGExcelRow[]> {
  const blocks = new Map<string, RGExcelRow[]>();
  for (const row of rows) {
    const key = `${normalizeStr(row.bairro)}|${normalizeStr(row.logradouro)}`;
    if (!blocks.has(key)) blocks.set(key, []);
    blocks.get(key)!.push(row);
  }
  return blocks;
}

function normalizeStr(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
}

// ─── Import to Firestore ─────────────────────────────────────

const MAX_ROWS = 10_000;
const MAX_FILE_MB = 5;

export async function importToFirestore(
  orgId: string,
  rgId: string,
  rows: RGExcelRow[],
  uploadedBy: string
): Promise<RGImportResult> {
  if (rows.length > MAX_ROWS) {
    return {
      success: false,
      totalRows: rows.length,
      importedProperties: 0,
      generatedBlocks: 0,
      errors: [
        {
          row: 0,
          field: 'file',
          message: `Máximo de ${MAX_ROWS} linhas por importação. Arquivo tem ${rows.length} linhas.`,
        },
      ],
      skipped: rows.length,
    };
  }

  const validatedRows = validateRows(rows);
  const validRows = validatedRows.filter((r) => r.isValid);
  const errors: RGImportError[] = validatedRows.flatMap((r) => r.errors);
  const skipped = validatedRows.length - validRows.length;

  if (validRows.length === 0) {
    return { success: false, totalRows: rows.length, importedProperties: 0, generatedBlocks: 0, errors, skipped };
  }

  const blocksMap = deriveBlocks(validRows);
  const BATCH_SIZE = 499;

  // We'll collect all writes and execute in batches
  interface BlockWrite {
    rgId: string;
    organizationId: string;
    bairro: string;
    logradouro: string;
    totalProperties: number;
    visitedCount: number;
    pendingCount: number;
    createdAt: ReturnType<typeof serverTimestamp>;
    uploadedBy: string;
  }
  interface PropertyWrite {
    rgId: string;
    blockId: string;
    organizationId: string;
    bairro: string;
    logradouro: string;
    numero: string;
    cidade: string;
    uf: string;
    cep: string;
    status: string;
    visitCount: number;
    visitHistory: unknown[];
    createdAt: ReturnType<typeof serverTimestamp>;
    uploadedBy: string;
  }

  const blockWrites: Array<{ ref: ReturnType<typeof doc>; data: BlockWrite }> = [];
  const propWrites: Array<{ ref: ReturnType<typeof doc>; data: PropertyWrite }> = [];

  for (const [, blockRows] of blocksMap.entries()) {
    const blockRef = doc(collection(db, 'rg_blocks'));
    blockWrites.push({
      ref: blockRef,
      data: {
        rgId,
        organizationId: orgId,
        bairro: blockRows[0].bairro,
        logradouro: blockRows[0].logradouro,
        totalProperties: blockRows.length,
        visitedCount: 0,
        pendingCount: blockRows.length,
        createdAt: serverTimestamp(),
        uploadedBy,
      },
    });

    for (const row of blockRows) {
      const propRef = doc(collection(db, 'rg_properties'));
      propWrites.push({
        ref: propRef,
        data: {
          rgId,
          blockId: blockRef.id,
          organizationId: orgId,
          bairro: row.bairro,
          logradouro: row.logradouro,
          numero: row.numero,
          cidade: row.cidade,
          uf: row.uf,
          cep: row.cep ?? '',
          status: 'pending',
          visitCount: 0,
          visitHistory: [],
          createdAt: serverTimestamp(),
          uploadedBy,
        },
      });
    }
  }

  // Write in batches
  const allWrites = [...blockWrites, ...propWrites];
  for (let i = 0; i < allWrites.length; i += BATCH_SIZE) {
    const batch = writeBatch(db);
    allWrites.slice(i, i + BATCH_SIZE).forEach(({ ref, data }) => batch.set(ref, data));
    await batch.commit();
  }

  // Update registry meta
  await updateRegistryMeta(rgId, {
    totalProperties: validRows.length,
    totalBlocks: blocksMap.size,
  });

  return {
    success: true,
    totalRows: rows.length,
    importedProperties: validRows.length,
    generatedBlocks: blocksMap.size,
    errors,
    skipped,
  };
}

export { MAX_FILE_MB };
