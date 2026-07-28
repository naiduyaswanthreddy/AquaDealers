import React, { useMemo, useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import { toast } from 'sonner';
import { AlertCircle, CheckCircle2, Download, FileUp, Trash2 } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { useAuthStore } from '@/stores/authStore';
import { useBranchStore } from '@/stores/branchStore';
import { useBulkCreateFarmers } from '../hooks/useFarmers';
import { CROP_STATUSES, RISK_STATUSES, AP_DISTRICTS } from '@/lib/constants';
import type { FarmerInsert } from '@/types/database';

// Column headers accepted in the Excel file. Keep in sync with the template.
// Only "Name" is required. Anything unknown in the file is silently skipped.
const HEADER_MAP: Record<string, keyof FarmerInsert | null> = {
  'Name': 'name',
  'Phone': 'phone',
  'Village': 'village',
  'Mandal': 'mandal',
  'District': 'district',
  'Pond Acres': 'pond_acres',
  'Stocking Date': 'stocking_date',
  'Crop Status': 'crop_status',
  'Risk Status': 'risk_status',
  'Credit Limit': 'credit_limit',
  'Default Medicine Discount %': 'default_medicine_discount_percentage',
  'Previous Due': 'opening_balance',
  'Opening Balance': 'opening_balance', // Backward-compatible import header.
  'Notes': 'notes',
};

const CROP_VALUES = new Set(CROP_STATUSES.map((s) => s.value));
const RISK_VALUES = new Set(RISK_STATUSES.map((s) => s.value));
const DISTRICTS = new Set(AP_DISTRICTS.map((d) => d.toLowerCase()));

interface Row {
  raw: Record<string, any>;
  parsed: Partial<FarmerInsert>;
  errors: string[];
  rowNumber: number; // 1-based, matches Excel row (+1 for header)
}

const toNum = (v: any) => {
  if (v === '' || v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : NaN;
};

const toDateISO = (v: any): string | null | 'INVALID' => {
  if (v === '' || v === null || v === undefined) return null;
  // Excel serial number -> JS Date
  if (typeof v === 'number') {
    const d = XLSX.SSF.parse_date_code(v);
    if (!d) return 'INVALID';
    return `${d.y}-${String(d.m).padStart(2, '0')}-${String(d.d).padStart(2, '0')}`;
  }
  const s = String(v).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const d = new Date(s);
  if (isNaN(d.getTime())) return 'INVALID';
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

function validateRow(raw: Record<string, any>, rowNumber: number): Row {
  const parsed: Partial<FarmerInsert> = {};
  const errors: string[] = [];

  const name = String(raw['Name'] ?? '').trim();
  if (!name) errors.push('Name is required');
  else parsed.name = name;

  const phone = raw['Phone'] == null ? '' : String(raw['Phone']).replace(/\D/g, '');
  if (phone) {
    if (phone.length < 10 || phone.length > 15) errors.push('Phone must be 10–15 digits');
    else parsed.phone = phone;
  }

  const village = raw['Village'] == null ? '' : String(raw['Village']).trim();
  if (village) parsed.village = village;

  const mandal = raw['Mandal'] == null ? '' : String(raw['Mandal']).trim();
  if (mandal) parsed.mandal = mandal;

  const district = raw['District'] == null ? '' : String(raw['District']).trim();
  if (district) {
    if (!DISTRICTS.has(district.toLowerCase())) errors.push(`District "${district}" not in AP districts list`);
    else parsed.district = district;
  }

  if (raw['Pond Acres'] != null && raw['Pond Acres'] !== '') {
    const n = toNum(raw['Pond Acres']);
    if (Number.isNaN(n) || (n as number) < 0) errors.push('Pond Acres must be 0 or a positive number');
    else parsed.pond_acres = n as number;
  }

  if (raw['Stocking Date'] != null && raw['Stocking Date'] !== '') {
    const d = toDateISO(raw['Stocking Date']);
    if (d === 'INVALID') errors.push('Stocking Date invalid (use YYYY-MM-DD)');
    else if (d) parsed.stocking_date = d;
  }

  const crop = String(raw['Crop Status'] ?? '').trim().toLowerCase();
  if (crop) {
    if (!CROP_VALUES.has(crop as any)) errors.push(`Crop Status must be one of: ${[...CROP_VALUES].join(', ')}`);
    else parsed.crop_status = crop;
  }

  const risk = String(raw['Risk Status'] ?? '').trim().toLowerCase();
  if (risk) {
    if (!RISK_VALUES.has(risk as any)) errors.push(`Risk Status must be one of: ${[...RISK_VALUES].join(', ')}`);
    else parsed.risk_status = risk;
  }

  if (raw['Credit Limit'] != null && raw['Credit Limit'] !== '') {
    const n = toNum(raw['Credit Limit']);
    if (Number.isNaN(n) || (n as number) < 0) errors.push('Credit Limit must be 0 or more');
    else parsed.credit_limit = n as number;
  }

  if (raw['Default Medicine Discount %'] != null && raw['Default Medicine Discount %'] !== '') {
    const n = toNum(raw['Default Medicine Discount %']);
    if (Number.isNaN(n) || (n as number) < 0 || (n as number) > 100) errors.push('Discount % must be 0–100');
    else parsed.default_medicine_discount_percentage = n as number;
  }

  const previousDue = raw['Previous Due'] ?? raw['Opening Balance'];
  if (previousDue != null && previousDue !== '') {
    const n = toNum(previousDue);
    if (Number.isNaN(n) || (n as number) < 0) errors.push('Previous Due must be 0 or more');
    else parsed.opening_balance = n as number;
  }

  const notes = raw['Notes'] == null ? '' : String(raw['Notes']).trim();
  if (notes) parsed.notes = notes;

  return { raw, parsed, errors, rowNumber };
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onImported?: (count: number) => void;
}

export const ImportFarmersExcelModal: React.FC<Props> = ({ isOpen, onClose, onImported }) => {
  const user = useAuthStore((s) => s.user);
  const activeBranchId = useBranchStore((s) => s.getActiveBranchId());
  const { mutateAsync: bulkCreate, isPending } = useBulkCreateFarmers();
  const fileRef = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [fileName, setFileName] = useState('');

  const validRows = useMemo(() => rows.filter((r) => r.errors.length === 0), [rows]);
  const errorRows = useMemo(() => rows.filter((r) => r.errors.length > 0), [rows]);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const wb = XLSX.read(ev.target?.result, { type: 'binary', cellDates: false });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        const json: any[] = XLSX.utils.sheet_to_json(sheet, { defval: '' });
        if (!json.length) { toast.error('Sheet is empty'); return; }
        const parsed = json.map((r, i) => validateRow(r, i + 2)); // +2 = header row + 1-indexed
        setRows(parsed);
        if (!parsed.some((r) => r.errors.length === 0)) {
          toast.error('No valid rows found. Check the errors below.');
        }
      } catch (err) {
        console.error(err);
        toast.error('Failed to read file. Make sure it is a valid Excel/CSV.');
      }
    };
    reader.readAsBinaryString(file);
  };

  const downloadTemplate = () => {
    const sample = {
      Name: 'Ravi Kumar',
      Phone: '9876543210',
      Village: 'Bhimavaram',
      Mandal: 'Bhimavaram',
      District: 'West Godavari',
      'Pond Acres': 2.5,
      'Stocking Date': '2026-01-15',
      'Crop Status': 'growing',
      'Risk Status': 'medium',
      'Credit Limit': 50000,
      'Default Medicine Discount %': 5,
      'Previous Due': 0,
      Notes: '',
    };
    const ws = XLSX.utils.json_to_sheet([sample]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Farmers');
    XLSX.writeFile(wb, 'Farmer_Import_Template.xlsx');
  };

  const handleImport = async () => {
    if (!user?.id || !validRows.length) return;
    const payload: FarmerInsert[] = validRows.map((r) => ({
      ...r.parsed,
      name: r.parsed.name!,
      dealer_id: user.id,
      branch_id: activeBranchId,
    }));
    try {
      await bulkCreate(payload);
      toast.success(`${payload.length} farmer${payload.length === 1 ? '' : 's'} imported.`);
      onImported?.(payload.length);
      reset();
      onClose();
    } catch {
      // toast handled in hook
    }
  };

  const reset = () => { setRows([]); setFileName(''); if (fileRef.current) fileRef.current.value = ''; };

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => { reset(); onClose(); }}
      title="Import Farmers from Excel"
      contentClassName="max-w-3xl"
      footerButtons={rows.length ? [
        { label: 'Clear', variant: 'ghost', onClick: reset, disabled: isPending },
        {
          label: isPending ? 'Importing…' : `Import ${validRows.length} valid`,
          variant: 'primary',
          onClick: handleImport,
          loading: isPending,
          disabled: validRows.length === 0,
        },
      ] : undefined}
    >
      {!rows.length && (
        <div className="grid gap-4">
          <p className="text-sm text-slate-600">
            Upload an Excel or CSV file to add many farmers at once. Only <span className="font-semibold">Name</span> is required — every other column is optional.
          </p>
          <button
            onClick={downloadTemplate}
            className="flex items-center gap-2 rounded-xl border border-sky-200 bg-sky-50 px-4 py-2.5 text-sm font-semibold text-sky-900 transition-all hover:bg-sky-100 self-start"
          >
            <Download className="w-4 h-4" /> Download template
          </button>

          <label className="flex cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 py-10 px-6 transition-all hover:border-sky-400 hover:bg-sky-50/40">
            <FileUp className="h-8 w-8 text-slate-400" />
            <div className="text-sm font-semibold text-slate-700">Click to choose an Excel or CSV file</div>
            <div className="text-xs text-slate-500">Supported: .xlsx, .xls, .csv</div>
            <input
              ref={fileRef}
              type="file"
              accept=".csv,.xls,.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
              onChange={handleFile}
              className="hidden"
            />
          </label>

          <details className="rounded-xl border border-slate-200 bg-white p-3 text-xs text-slate-600">
            <summary className="cursor-pointer font-semibold text-slate-800">Accepted columns (any order)</summary>
            <ul className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1">
              {Object.keys(HEADER_MAP).map((h) => <li key={h}>• {h}</li>)}
            </ul>
            <p className="mt-2 text-slate-500">
              Crop Status: {[...CROP_VALUES].join(', ')}. Risk Status: {[...RISK_VALUES].join(', ')}. Dates: YYYY-MM-DD.
            </p>
          </details>
        </div>
      )}

      {rows.length > 0 && (
        <div className="grid gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <div className="text-xs text-slate-500 truncate">{fileName}</div>
            <button onClick={reset} className="ml-auto flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-red-600">
              <Trash2 className="w-3.5 h-3.5" /> Clear file
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3">
              <div className="flex items-center gap-2 text-emerald-900">
                <CheckCircle2 className="w-4 h-4" />
                <span className="text-xs font-bold uppercase tracking-wider">Valid</span>
              </div>
              <div className="mt-1 text-2xl font-black text-emerald-950">{validRows.length}</div>
            </div>
            <div className="rounded-xl border border-rose-200 bg-rose-50 p-3">
              <div className="flex items-center gap-2 text-rose-900">
                <AlertCircle className="w-4 h-4" />
                <span className="text-xs font-bold uppercase tracking-wider">Errors</span>
              </div>
              <div className="mt-1 text-2xl font-black text-rose-950">{errorRows.length}</div>
            </div>
          </div>

          {errorRows.length > 0 && (
            <div className="rounded-xl border border-rose-200 bg-rose-50/60 max-h-40 overflow-y-auto">
              <div className="sticky top-0 bg-rose-100 px-3 py-2 text-xs font-bold uppercase tracking-wider text-rose-900">
                Rows with errors (will be skipped)
              </div>
              <ul className="divide-y divide-rose-100 text-xs">
                {errorRows.slice(0, 100).map((r) => (
                  <li key={r.rowNumber} className="px-3 py-2">
                    <span className="font-bold text-rose-900">Row {r.rowNumber}</span>
                    <span className="text-slate-600"> ({String(r.raw['Name'] || '—')}): </span>
                    <span className="text-rose-700">{r.errors.join('; ')}</span>
                  </li>
                ))}
                {errorRows.length > 100 && <li className="px-3 py-2 text-slate-500">…and {errorRows.length - 100} more</li>}
              </ul>
            </div>
          )}

          {validRows.length > 0 && (
            <div className="rounded-xl border border-slate-200 max-h-56 overflow-auto">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-slate-100">
                  <tr>
                    <th className="px-2 py-2 text-left font-bold">Name</th>
                    <th className="px-2 py-2 text-left font-bold">Phone</th>
                    <th className="px-2 py-2 text-left font-bold">Village</th>
                    <th className="px-2 py-2 text-right font-bold">Credit Limit</th>
                     <th className="px-2 py-2 text-right font-bold">Previous Due</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {validRows.slice(0, 20).map((r) => (
                    <tr key={r.rowNumber}>
                      <td className="px-2 py-1.5 font-semibold">{r.parsed.name}</td>
                      <td className="px-2 py-1.5">{r.parsed.phone || '—'}</td>
                      <td className="px-2 py-1.5">{r.parsed.village || '—'}</td>
                      <td className="px-2 py-1.5 text-right">{r.parsed.credit_limit ?? '—'}</td>
                      <td className="px-2 py-1.5 text-right">{r.parsed.opening_balance ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {validRows.length > 20 && (
                <div className="px-3 py-2 text-xs text-slate-500">…and {validRows.length - 20} more valid rows</div>
              )}
            </div>
          )}
        </div>
      )}
    </Modal>
  );
};

export default ImportFarmersExcelModal;
