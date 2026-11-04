"use client";

import { useState, useTransition, type ReactNode } from "react";
import { Icon } from "@/components/shell/icons";
import { Button } from "@/components/ui/Button";
import { cx } from "@/components/ui/cx";
import { Modal } from "@/components/ui/Modal";
import { Picker } from "@/components/ui/Picker";
import { Toggle } from "@/components/ui/Toggle";
import { disableCardDesign, enableCardDesign, saveCardDesign } from "@/lib/actions/admin";
import { CARD_PATTERNS, CARD_PRESETS, CARD_THEME_ORDER, cleanHex, designId, designKey, designLook, isHex, knownName } from "@/lib/domain/card-looks";
import type { CardDesign, CardDesignKind } from "@/lib/domain/types";
import { toast } from "@/stores/toast-store";
import { CardPreview } from "./CardPreview";

export type KindMap<T> = Record<CardDesignKind, T>;

const KINDS: CardDesignKind[] = ["theme", "swatch", "pattern"];
const KIND_HELP: KindMap<string> = {
  theme: "One of the app's seven finishes. Customers can wear it in any enabled pattern.",
  swatch: "A ready-made colour in “Make your own”. Customers can still pick any colour on the slider.",
  pattern: "An overlay for any finish or colour. Turning one off hides it from every picker.",
};

type Draft = { kind: CardDesignKind; key: string; name: string; nameTouched: boolean; sortOrder: string; sortTouched: boolean; enabled: boolean };
type Errors = Record<string, string[] | undefined>;

/** Keys the app can paint for a kind, minus the ones already added (create only). */
function keyOptions(kind: "theme" | "pattern", taken: string[]) {
  const all = kind === "theme" ? CARD_THEME_ORDER.map((k) => ({ value: k, label: CARD_PRESETS[k].name })) : CARD_PATTERNS.map((p) => ({ value: p.id, label: p.name }));
  return all.filter((o) => !taken.includes(o.value)).map((o) => ({ ...o, hint: o.value }));
}

function blank(kind: CardDesignKind, nextSort: KindMap<number>, taken: KindMap<string[]>): Draft {
  const key = kind === "swatch" ? "" : (keyOptions(kind, taken[kind])[0]?.value ?? "");
  return { kind, key, name: key ? knownName(kind, key) : "", nameTouched: false, sortOrder: String(nextSort[kind]), sortTouched: false, enabled: true };
}

const fromDesign = (d: CardDesign): Draft => ({ kind: d.kind, key: designKey(d), name: d.name, nameTouched: true, sortOrder: String(d.sortOrder), sortTouched: true, enabled: d.enabled });

const input = "h-10 w-full rounded-chip border-2 border-edge bg-surface px-3 text-[13px] outline-none focus:border-purple-500 focus-visible:outline-none disabled:opacity-60 aria-invalid:border-error-500";

function Field({ label, error, hint, children, className }: { label: string; error?: string[]; hint?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <div className={cx("block min-w-0", className)}>
      <span className="mb-1.5 block text-[11.5px] font-bold uppercase tracking-wider">{label}</span>
      {children}
      {error?.length ? <p className="mt-1 text-[12px] font-medium text-error-600">{error[0]}</p> : hint ? <p className="mt-1 text-[12px] text-muted">{hint}</p> : null}
    </div>
  );
}

/**
 * The create / edit form. Only keys the app can paint are on offer (a dropdown for themes and
 * patterns, a hex colour for swatches); the id is derived from the key, as the seeder does it.
 */
function DesignForm({ design, nextSort, taken, onDone, onCancel }: { design?: CardDesign; nextSort: KindMap<number>; taken: KindMap<string[]>; onDone: () => void; onCancel: () => void }) {
  const creating = !design;
  const [d, setD] = useState<Draft>(() => (design ? fromDesign(design) : blank("theme", nextSort, taken)));
  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const setKey = (key: string) => {
    setErrors((e) => ({ ...e, key: undefined }));
    setD((x) => ({ ...x, key, name: x.nameTouched ? x.name : knownName(x.kind, key) }));
  };
  // a new kind starts clean: its own key, name and next order (unless you typed them)
  const setKind = (kind: CardDesignKind) => {
    setErrors({});
    setFormError(null);
    setD((x) => {
      const b = blank(kind, nextSort, taken);
      return { ...b, name: x.nameTouched ? x.name : b.name, nameTouched: x.nameTouched, sortOrder: x.sortTouched ? x.sortOrder : b.sortOrder, sortTouched: x.sortTouched, enabled: x.enabled };
    });
  };

  const key = d.kind === "swatch" ? cleanHex(d.key) : d.key;
  const keyOk = d.kind === "swatch" ? isHex(key) : !!key;
  const look = keyOk ? designLook(d.kind, key) : null;
  const id = design ? design.id : keyOk ? designId(d.kind, key) : `${d.kind}-…`;
  const takenNow = creating && keyOk && taken[d.kind].includes(key);
  const options = d.kind === "swatch" ? [] : creating ? keyOptions(d.kind, taken[d.kind]) : [];

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!keyOk) {
      setErrors({ key: [d.kind === "swatch" ? "Enter a 6-digit hex colour, e.g. FF7A5C." : `Pick a ${d.kind}.`] });
      return;
    }
    start(async () => {
      const r = await saveCardDesign(
        { kind: d.kind, key, name: d.name, enabled: d.enabled, sortOrder: Number(d.sortOrder) },
        design ? { id: design.id, version: design.version } : undefined,
      );
      if (r.ok) {
        toast.success(r.message);
        onDone();
        return;
      }
      setErrors(r.fieldErrors ?? {});
      setFormError(r.message);
    });
  };

  return (
    <form onSubmit={submit} className="flex min-h-full flex-col">
      <fieldset disabled={pending} className="grid grid-cols-1 gap-4 p-6 sm:grid-cols-2">
        <div className="flex justify-center sm:col-span-2">
          <CardPreview look={look} width={288} face />
        </div>

        {creating && (
          <div className="sm:col-span-2">
            <span className="mb-1.5 block text-[11.5px] font-bold uppercase tracking-wider">Kind</span>
            <div className="inline-flex gap-1 rounded-full border-2 border-edge bg-surface p-1" role="radiogroup" aria-label="Kind">
              {KINDS.map((k) => (
                <button key={k} type="button" role="radio" aria-checked={d.kind === k} onClick={() => setKind(k)} className={cx("press h-8 cursor-pointer rounded-full px-3.5 text-[12.5px] font-semibold capitalize", d.kind === k ? "bg-ink-900 text-white dark:bg-orange-500 dark:text-ink-900" : "text-fg/70")}>
                  {k}
                </button>
              ))}
            </div>
            <p className="mt-1.5 text-[12px] text-muted">{KIND_HELP[d.kind]}</p>
          </div>
        )}

        {d.kind === "swatch" ? (
          <Field label="Colour (hex)" error={errors.key} hint={takenNow ? "Already added: edit or turn on its row instead." : undefined}>
            <span className="flex items-center gap-2">
              <span className="relative flex-1">
                <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 font-mono text-[13px] text-muted">#</span>
                <input
                  value={d.key}
                  onChange={(e) => setKey(cleanHex(e.target.value))}
                  disabled={!creating}
                  required
                  pattern="[0-9A-Fa-f]{6}"
                  title="6 hex digits, e.g. FF7A5C"
                  maxLength={7}
                  placeholder="FF7A5C"
                  aria-invalid={!!errors.key?.length || undefined}
                  className={cx(input, "pl-6 font-mono uppercase")}
                />
              </span>
              {creating && (
                <input type="color" aria-label="Pick a colour" value={keyOk ? `#${key}` : "#FF7A5C"} onChange={(e) => setKey(cleanHex(e.target.value))} className="h-10 w-12 shrink-0 cursor-pointer rounded-chip border-2 border-edge bg-surface p-1" />
              )}
            </span>
          </Field>
        ) : creating ? (
          <Field label={d.kind === "theme" ? "Theme" : "Pattern"} error={errors.key} hint={options.length ? undefined : `Every ${d.kind} the app can paint is already here.`}>
            <Picker value={d.key} options={options} onChange={setKey} placeholder={options.length ? `Pick a ${d.kind}` : "None left"} label={d.kind === "theme" ? "Theme" : "Pattern"} size="md" disabled={!options.length} />
          </Field>
        ) : (
          <Field label={d.kind === "theme" ? "Theme" : "Pattern"} error={errors.key}>
            <div className={cx(input, "flex items-center bg-sunken font-mono")}>{d.key || "—"}</div>
          </Field>
        )}

        <Field label="Id" hint="Made from the kind and key.">
          <div className={cx(input, "flex items-center truncate bg-sunken font-mono text-muted")}>{id}</div>
        </Field>

        <Field label="Name" error={errors.name} hint="What customers see in the app.">
          <input value={d.name} onChange={(e) => setD((x) => ({ ...x, name: e.target.value, nameTouched: true }))} required maxLength={64} placeholder="e.g. Coral" aria-invalid={!!errors.name?.length || undefined} className={input} />
        </Field>

        <Field label="Order" error={errors.sortOrder} hint="Lower shows first in the app.">
          <input type="number" value={d.sortOrder} onChange={(e) => setD((x) => ({ ...x, sortOrder: e.target.value, sortTouched: true }))} required min={0} max={10000} step={1} inputMode="numeric" aria-invalid={!!errors.sortOrder?.length || undefined} className={cx(input, "num")} />
        </Field>

        <div className="flex items-center gap-3 sm:col-span-2">
          <Toggle on={d.enabled} onChange={(on) => setD((x) => ({ ...x, enabled: on }))} label="Offered in the app" disabled={pending} />
          <span className="text-[13px] font-semibold">{d.enabled ? "Offered in the app" : "Hidden from the app"}</span>
        </div>

        {formError && <p role="alert" className="rounded-chip border-2 border-error-500/50 bg-error-50 px-3 py-2 text-[12.5px] font-medium text-error-600 sm:col-span-2 dark:bg-error-600/25 dark:text-error-50">{formError}</p>}
      </fieldset>
      <footer className="sticky bottom-0 mt-auto flex flex-wrap items-center justify-between gap-3 border-t-2 border-line bg-sunken px-6 py-3.5">
        <Button variant="ghost" onClick={onCancel}>Cancel</Button>
        <Button type="submit" variant="primary" disabled={pending || (creating && (takenNow || (d.kind !== "swatch" && !options.length)))}>
          {pending ? "Saving…" : creating ? "Create design" : "Save design"}
        </Button>
      </footer>
    </form>
  );
}

/** "New design" button + the create modal. */
export function NewCardDesign({ nextSort, taken }: { nextSort: KindMap<number>; taken: KindMap<string[]> }) {
  const [open, setOpen] = useState(false);
  // a fresh form per opening
  const [n, setN] = useState(0);
  return (
    <>
      <Button variant="primary" onClick={() => { setN((x) => x + 1); setOpen(true); }}><Icon name="plus" size={15} /> New design</Button>
      <Modal open={open} onClose={() => setOpen(false)} title="New card design" subtitle="Only looks the app can paint are on offer. The app shows enabled designs, in your order and with your names.">
        <DesignForm key={n} nextSort={nextSort} taken={taken} onDone={() => setOpen(false)} onCancel={() => setOpen(false)} />
      </Modal>
    </>
  );
}

const NONE: KindMap<number> = { theme: 0, swatch: 0, pattern: 0 };
const NO_KEYS: KindMap<string[]> = { theme: [], swatch: [], pattern: [] };

/** A row's Edit and Turn off / Turn on, each row with its own pending state. */
export function CardDesignActions({ design }: { design: CardDesign }) {
  const [editing, setEditing] = useState(false);
  const [n, setN] = useState(0);
  const [confirming, setConfirming] = useState(false);
  const [pending, start] = useTransition();

  const toggle = (on: boolean) =>
    start(async () => {
      const r = await (on ? enableCardDesign(design.id, design.version) : disableCardDesign(design.id, design.version));
      (r.ok ? toast.success : toast.error)(r.message);
      setConfirming(false);
    });

  return (
    <>
      <div className="flex justify-end gap-1.5">
        <Button size="sm" onClick={() => { setN((x) => x + 1); setEditing(true); }} disabled={pending}>Edit</Button>
        {design.enabled ? (
          <Button size="sm" variant="ghost" onClick={() => setConfirming(true)} disabled={pending}>Turn off</Button>
        ) : (
          <Button size="sm" variant="primary" onClick={() => toggle(true)} disabled={pending}>{pending ? "Turning on…" : "Turn on"}</Button>
        )}
      </div>

      <Modal open={editing} onClose={() => setEditing(false)} title={`Edit · ${design.name}`} subtitle="The key is fixed once a design exists; add a new design for a different look.">
        <DesignForm key={n} design={design} nextSort={NONE} taken={NO_KEYS} onDone={() => setEditing(false)} onCancel={() => setEditing(false)} />
      </Modal>

      <Modal open={confirming} onClose={() => !pending && setConfirming(false)} title={`Turn off ${design.name}?`}>
        <div className="space-y-5 p-6">
          <div className="flex items-center gap-4">
            <CardPreview look={designLook(design.kind, designKey(design))} width={96} />
            <p className="text-[13.5px]">Customers won&apos;t be able to pick <b>{design.name}</b> in the app any more. Cards already using it keep their look. You can turn it back on later.</p>
          </div>
          <div className="flex justify-end gap-2">
            <Button onClick={() => setConfirming(false)} disabled={pending}>Cancel</Button>
            <Button variant="danger" onClick={() => toggle(false)} disabled={pending}>{pending ? "Turning off…" : "Turn off"}</Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
