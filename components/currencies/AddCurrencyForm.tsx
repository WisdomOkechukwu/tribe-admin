"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { createCurrency } from "@/lib/actions/admin";
import { toast } from "@/stores/toast-store";

export type ProviderOpt = { id: string; name: string };

type Kind = "fiat" | "crypto";
type Source = "fiat_feed" | "coinbase" | "usd_peg";

/** Where a new currency's live price can come from, per kind. The first one is the usual choice. */
const SOURCES: Record<Kind, { value: Source; label: string; hint: string }[]> = {
  fiat: [
    { value: "fiat_feed", label: "Fiat rates feed", hint: "Daily rate by currency code (ZAR, AED…)." },
    { value: "usd_peg", label: "Pegged to $1", hint: "Always worth exactly one US dollar." },
  ],
  crypto: [
    { value: "coinbase", label: "Coinbase spot price", hint: "Live CODE-USD price (DOGE, LTC…)." },
    { value: "usd_peg", label: "Pegged to $1", hint: "A stablecoin: always exactly one US dollar." },
  ],
};

const field = "h-11 w-full rounded-chip border-2 border-edge bg-surface px-3.5 text-[13.5px] outline-none focus:border-purple-500 focus:shadow-hard-sm focus-visible:outline-none disabled:opacity-60";
const label = "mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-muted";

/**
 * Adds a currency or coin. The API creates it SWITCHED OFF with everything it
 * needs (its margin row, provider link and the company's ledger accounts),
 * and refuses a code it cannot price; its card then has the switch to turn it on.
 */
export function AddCurrencyForm({ providers }: { providers: ProviderOpt[] }) {
  const [pending, start] = useTransition();
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [symbol, setSymbol] = useState("");
  const [kind, setKind] = useState<Kind>("fiat");
  const [decimals, setDecimals] = useState("2");
  const [source, setSource] = useState<Source>("fiat_feed");
  const [providerId, setProviderId] = useState(providers[0]?.id ?? "");
  const places = Number(decimals);
  const valid = /^[A-Z0-9]{2,10}$/.test(code) && name.trim().length > 0 && Number.isInteger(places) && places >= 0 && places <= 8 && providerId !== "";

  const pickKind = (next: Kind) => {
    setKind(next);
    setSource(SOURCES[next][0].value);
    setDecimals(next === "fiat" ? "2" : "8");
  };
  const submit = () =>
    start(async () => {
      const r = await createCurrency({ code, name: name.trim(), kind, symbol: symbol.trim(), decimalPlaces: places, conversionProviderId: providerId, priceSource: source });
      (r.ok ? toast.success : toast.error)(r.message);
      if (r.ok) {
        setCode("");
        setName("");
        setSymbol("");
        setOpen(false);
      }
    });

  if (!open) return <Button variant="primary" onClick={() => setOpen(true)}>Add a currency</Button>;
  return (
    <form className="card space-y-5 p-5" aria-busy={pending} onSubmit={(e) => { e.preventDefault(); if (valid) submit(); }}>
      <div>
        <h2 className="display text-[22px] font-extrabold uppercase">Add a currency</h2>
        <p className="mt-1 text-[12.5px] text-muted">It is created switched off, with its vault and the rest of its ledger accounts. Switch it on from its card when you are ready. The code, kind and decimal places cannot be changed later.</p>
      </div>
      <fieldset disabled={pending} className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <label>
          <span className={label}>Code</span>
          <input className={field} value={code} onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 10))} placeholder="ZAR" aria-label="Currency code" required />
        </label>
        <label className="sm:col-span-1 lg:col-span-2">
          <span className={label}>Name</span>
          <input className={field} value={name} onChange={(e) => setName(e.target.value.slice(0, 64))} placeholder="South African Rand" aria-label="Currency name" required />
        </label>
        <label>
          <span className={label}>Symbol (optional)</span>
          <input className={field} value={symbol} onChange={(e) => setSymbol(e.target.value.slice(0, 8))} placeholder="R" aria-label="Currency symbol" />
        </label>
        <label>
          <span className={label}>Kind</span>
          <select className={field} value={kind} onChange={(e) => pickKind(e.target.value as Kind)} aria-label="Kind">
            <option value="fiat">Fiat currency</option>
            <option value="crypto">Crypto coin</option>
          </select>
        </label>
        <label>
          <span className={label}>Decimal places</span>
          <input className={field} inputMode="numeric" value={decimals} onChange={(e) => setDecimals(e.target.value.replace(/\D/g, "").slice(0, 1))} aria-label="Decimal places (0 to 8)" required />
        </label>
        <label>
          <span className={label}>Live price from</span>
          <select className={field} value={source} onChange={(e) => setSource(e.target.value as Source)} aria-label="Where the live price comes from">
            {SOURCES[kind].map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </label>
        <label>
          <span className={label}>Converted by</span>
          <select className={field} value={providerId} onChange={(e) => setProviderId(e.target.value)} aria-label="Provider that converts it">
            {providers.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </label>
      </fieldset>
      <p className="text-[12px] text-muted">{SOURCES[kind].find((s) => s.value === source)?.hint} We check the price can be fetched before saving.</p>
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="primary" type="submit" disabled={pending || !valid}>{pending ? "Adding…" : "Add currency"}</Button>
        <Button variant="ghost" onClick={() => setOpen(false)} disabled={pending}>Cancel</Button>
      </div>
    </form>
  );
}
