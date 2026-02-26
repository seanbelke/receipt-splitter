import Image from "next/image";
import Button from "@mui/material/Button";
import ButtonBase from "@mui/material/ButtonBase";
import CircularProgress from "@mui/material/CircularProgress";
import { ChangeEvent, FormEvent, RefObject } from "react";
import { AssignableUnit, ParsedReceipt } from "@/lib/types";
import { toCents } from "@/lib/currency";
import { moneyFromCents } from "@/lib/split";
import { ChatIcon, CheckIcon, EditIcon, TrashIcon, UploadIcon, UsersIcon } from "./icons";

export type SetupStepProps = {
  file: File | null;
  selectedImageUrl: string | null;
  isParsing: boolean;
  people: string[];
  newPerson: string;
  receipt: ParsedReceipt | null;
  units: AssignableUnit[];
  overallSubtotal: number;
  taxCents: number;
  tipCents: number;
  editingItemRowIndex: number | null;
  fileInputRef: RefObject<HTMLInputElement | null>;
  newPersonInputRef: RefObject<HTMLInputElement | null>;
  onFileChange: (event: ChangeEvent<HTMLInputElement>) => void;
  removeSelectedFile: () => void;
  parseReceipt: (event: FormEvent) => Promise<void>;
  onAddPersonSubmit: (event: FormEvent) => void;
  setNewPerson: (value: string) => void;
  removePerson: (name: string) => void;
  setTaxCents: (value: number) => void;
  setTipCents: (value: number) => void;
  updateReceiptItem: (rowIndex: number, updates: Partial<ParsedReceipt["items"][number]>) => void;
  setEditingItemRowIndex: (index: number | null) => void;
  openImagePreview: () => void;
  goToClaims: () => void;
};

export function SetupStep(props: SetupStepProps) {
  const {
    file,
    selectedImageUrl,
    isParsing,
    people,
    newPerson,
    receipt,
    units,
    overallSubtotal,
    taxCents,
    tipCents,
    editingItemRowIndex,
    fileInputRef,
    newPersonInputRef,
    onFileChange,
    removeSelectedFile,
    parseReceipt,
    onAddPersonSubmit,
    setNewPerson,
    removePerson,
    setTaxCents,
    setTipCents,
    updateReceiptItem,
    setEditingItemRowIndex,
    openImagePreview,
    goToClaims,
  } = props;

  return (
    <div className="space-y-7">
      <div>
        <p className="step-kicker flex items-center gap-2">
          <span className="icon-badge">
            <UploadIcon />
          </span>
          Step 1
        </p>
        <h2 className="mt-2 text-3xl font-semibold">Upload a receipt and add everyone.</h2>
      </div>

      <form onSubmit={parseReceipt} className="space-y-4">
        <div className="space-y-2">
          <h3 className="text-lg font-semibold text-slate-900">Upload a receipt</h3>
          <hr className="border-slate-200/90" />
        </div>

        <label className="block rounded-2xl border border-dashed border-slate-400/70 bg-white/90 p-6">
          <span className="mb-2 block text-sm font-medium text-slate-700">Receipt image</span>
          <input
            ref={fileInputRef}
            id="receipt-image-input"
            type="file"
            accept="image/*"
            onChange={onFileChange}
            className="sr-only"
          />
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <label
              htmlFor="receipt-image-input"
              className="file-picker-btn inline-flex cursor-pointer items-center gap-2 px-4 py-2 text-sm font-semibold"
            >
              <UploadIcon />
              {file ? "Replace file" : "Choose file"}
            </label>
            <span className="text-sm text-slate-500">{file ? file.name : "No file selected"}</span>
          </div>
          <p className="mt-2 text-xs text-slate-500">
            Supported formats: JPG, PNG, HEIC, and most mobile photo types.
          </p>
        </label>

        {file && selectedImageUrl && (
          <div className="soft-card flex items-center justify-between gap-2 rounded-xl p-2 sm:p-3">
            <ButtonBase
              component="button"
              onClick={openImagePreview}
              className="group flex min-w-0 flex-1 items-center gap-3 rounded-lg p-1.5 text-left transition hover:bg-slate-100/80"
              sx={{ minWidth: 0, justifyContent: "flex-start" }}
            >
              <span className="h-14 w-14 shrink-0 overflow-hidden rounded-lg border border-slate-200 bg-white">
                <Image
                  src={selectedImageUrl}
                  alt={`Selected receipt image: ${file.name}`}
                  width={56}
                  height={56}
                  unoptimized
                  className="h-full w-full object-cover"
                />
              </span>
              <span className="min-w-0">
                <span className="block text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                  Selected image
                </span>
                <span className="mt-0.5 block truncate text-sm font-medium text-slate-900">{file.name}</span>
                <span className="mono mt-1 inline-block rounded-md bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                  {Math.round(file.size / 1024)} KB
                </span>
              </span>
            </ButtonBase>
            <Button
              type="button"
              onClick={removeSelectedFile}
              aria-label="Remove selected image"
              title="Remove selected image"
              className="secondary-btn shrink-0 p-2.5 text-slate-600"
              sx={{ minWidth: 0 }}
            >
              <TrashIcon />
            </Button>
          </div>
        )}

        <Button
          type="submit"
          disabled={!file || isParsing}
          aria-busy={isParsing}
          className="primary-btn parse-receipt-btn inline-flex items-center gap-2 px-5 py-3"
        >
          {isParsing ? (
            <>
              <CircularProgress color="inherit" size={16} />
              <span className="inline-flex items-center">Parsing receipt</span>
            </>
          ) : (
            <>
              <UploadIcon />
              Parse receipt
            </>
          )}
        </Button>
      </form>

      <div className="space-y-2">
        <h3 className="text-lg font-semibold text-slate-900">Add everyone&apos;s names</h3>
        <hr className="border-slate-200/90" />
      </div>

      <div className="soft-card rounded-2xl p-5">
        <p className="mb-3 text-sm text-slate-700">People involved (names must be unique):</p>
        <div className="flex flex-wrap gap-2">
          {people.map((person) => (
            <Button
              key={person}
              onClick={() => removePerson(person)}
              className="rounded-full bg-teal-50 px-3 py-1 text-sm text-teal-900 transition hover:bg-rose-50 hover:text-rose-900"
            >
              {person} ×
            </Button>
          ))}
          {people.length === 0 && <p className="text-sm text-slate-500">No people added yet.</p>}
        </div>

        <form onSubmit={onAddPersonSubmit} className="mt-4 flex flex-col gap-2 sm:flex-row">
          <input
            ref={newPersonInputRef}
            value={newPerson}
            onChange={(e) => setNewPerson(e.target.value)}
            placeholder="Add a name"
            className="input-field flex-1"
          />
          <Button type="submit" className="secondary-btn inline-flex items-center gap-2 px-4 py-2">
            <UsersIcon />
            Add person
          </Button>
        </form>
      </div>

      <div className="space-y-2">
        <h3 className="text-lg font-semibold text-slate-900">Preview parsed receipt</h3>
        <hr className="border-slate-200/90" />
      </div>

      <section className="space-y-3">
        {receipt ? (
          <>
            <p className="text-sm text-slate-700">
              Parsed {receipt.items.length} rows into {units.length} assignable units. Currency: {receipt.currency}.
            </p>
            <div className="space-y-1 text-sm text-slate-600">
              <p>Subtotal: ${moneyFromCents(overallSubtotal)}</p>
              <p>Tax: ${moneyFromCents(taxCents)}</p>
              <p>Tip: ${moneyFromCents(tipCents)}</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-sm font-medium text-slate-700">
                Tax ($)
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={(taxCents / 100).toFixed(2)}
                  onChange={(e) => setTaxCents(toCents(e.target.value))}
                  className="input-field mt-1"
                />
              </label>
              <label className="text-sm font-medium text-slate-700">
                Tip ($)
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={(tipCents / 100).toFixed(2)}
                  onChange={(e) => setTipCents(toCents(e.target.value))}
                  className="input-field mt-1"
                />
              </label>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-slate-300">
                    <th className="px-3 py-2 text-left font-semibold text-slate-700">Item</th>
                    <th className="px-3 py-2 text-left font-semibold text-slate-700">Qty</th>
                    <th className="px-3 py-2 text-right font-semibold text-slate-700">Row total</th>
                  </tr>
                </thead>
                <tbody>
                  {receipt.items.map((item, index) => {
                    const isEditing = editingItemRowIndex === index;
                    return (
                      <tr key={`${item.name}-${index}`} className="border-b border-slate-200">
                        <td className="px-3 py-2 text-slate-800">
                          <div className="flex items-center gap-2">
                            <input
                              type="text"
                              value={item.name}
                              readOnly={!isEditing}
                              onChange={(event) =>
                                updateReceiptItem(index, {
                                  name: event.target.value,
                                })
                              }
                              className={`w-full rounded-md border px-2 py-1 ${
                                isEditing ? "border-slate-300 bg-white" : "border-transparent bg-transparent"
                              }`}
                            />
                            <Button
                              type="button"
                              onClick={() => setEditingItemRowIndex(isEditing ? null : index)}
                              className="rounded-md p-1 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
                              aria-label={isEditing ? "Done editing item" : "Edit item"}
                              title={isEditing ? "Done" : "Edit name/price"}
                            >
                              {isEditing ? <CheckIcon /> : <EditIcon />}
                            </Button>
                          </div>
                        </td>
                        <td className="px-3 py-2 text-slate-600">{item.quantity}</td>
                        <td className="mono px-3 py-2 text-right text-slate-700">
                          <input
                            type="number"
                            min={0}
                            step="0.01"
                            value={(item.totalPriceCents / 100).toFixed(2)}
                            readOnly={!isEditing}
                            onChange={(event) =>
                              updateReceiptItem(index, {
                                totalPriceCents: toCents(event.target.value),
                              })
                            }
                            className={`mono w-28 rounded-md border px-2 py-1 text-right ${
                              isEditing ? "border-slate-300 bg-white" : "border-transparent bg-transparent"
                            }`}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <p className="text-sm text-slate-700">
            {isParsing
              ? "Parsing receipt in the background. You can add everyone's names now."
              : "Receipt has not been parsed yet. Choose a photo and parse when ready."}
          </p>
        )}
      </section>

      <Button
        onClick={goToClaims}
        disabled={people.length === 0 || !receipt || isParsing}
        className="primary-btn inline-flex items-center gap-2 px-5 py-3"
      >
        <ChatIcon />
        {receipt ? "Continue to chat claims pre-fill" : "Waiting for parsed receipt"}
      </Button>
    </div>
  );
}
