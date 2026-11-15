// Domain model for the admin console, mapped from the Go admin API
// (tribe-backend, /admin-api). lib/data/repo.ts converts Go's snake_case
// resources into these shapes.
//
// Money is ALWAYS a decimal string ("12.50", "0.00500000"), converted from the
// API's smallest units with each asset's decimal places. Never do arithmetic on
// money with JS numbers; format it with lib/format.ts.

export type AssetCode =
  | "NGN" | "USD" | "GBP" | "EUR" | "KES" | "GHS" | "CAD"
  | "BTC" | "ETH" | "USDT" | "USDC" | "SOL";

/** Decimal string in major units. */
export type Amount = string;
export type Money = { asset: AssetCode; amount: Amount };

export type Page<T> = { rows: T[]; total: number; page: number; pageSize: number; pages: number };

// ── Customers ──────────────────────────────────────────────
export type KycTier = 0 | 1 | 2 | 3;
export type KycStatus = "none" | "pending" | "approved" | "failed";
export type CustomerStatus = "active" | "frozen" | "closed";

export type CustomerRow = {
  id: string;
  firstName: string;
  lastName: string;
  tag: string;
  email: string;
  phone: string;
  country: string;
  status: CustomerStatus;
  labels: string[];
  kycTier: KycTier;
  kycStatus: KycStatus;
  createdAt: string;
  lastActiveAt: string | null;
  version: number;
};

export type Device = {
  id: string;
  name: string;
  platform: string;
  model: string;
  appVersion: string;
  status: string;
  lastSeenAt: string | null;
  activatedAt: string | null;
  createdAt: string;
};

export type VirtualCard = {
  id: string;
  label: string;
  network: string;
  last4: string;
  currency: string;
  frozen: boolean;
  status: string;
  designFinish: string;
  createdAt: string;
};

export type WalletBalance = { account: string; accountNumber: string; asset: AssetCode; balance: Amount };

export type Customer = CustomerRow & {
  address: string;
  dob: string;
  balances: WalletBalance[];
  devices: Device[];
  cards: VirtualCard[];
  txCount: number;
  /** When this was read from the API (reference "now" for relative times). */
  fetchedAt: number;
};

// ── Verifications (KYC) ────────────────────────────────────
// A customer sends ONE request (submission) per tier; it holds that tier's checks
// (e.g. NIN + selfie). Admins approve or reject the whole request. Only one request
// per customer can be open at a time.
export type SubmissionStatus = "pending" | "approved" | "rejected";

export type VerificationCheck = {
  id: string;
  check: string;
  status: string;
  provider: string;
  reference: string;
  documentType?: string;
  documentMasked?: string;
  matchScore?: number;
};

export type VerificationSubmission = {
  id: string;
  customerId: string;
  tier: number;
  status: SubmissionStatus;
  /** rejection reason (the customer sees it) */
  reason?: string;
  submittedAt: string;
  decidedAt?: string;
  decidedBy?: string;
  /** 1 for the first request for this tier, 2 for the first retry… */
  attempt: number;
  /** why the customer's previous request for this tier was rejected */
  previousReason?: string;
  checks: VerificationCheck[];
  customerName: string;
  customerTag: string;
  customerEmail: string;
  currentTier: number;
};

// ── Transactions ───────────────────────────────────────────
export type TxCategory = "currency" | "virtual_card" | "cashpoint" | "utility" | "giftcard";
export type TxStatus = "completed" | "pending" | "failed" | "cancelled" | "reversed";

export type TxRow = {
  id: string;
  reference: string;
  customerId: string;
  customerName?: string;
  customerTag?: string;
  category: TxCategory;
  /** Backend type, e.g. swap, send, card_fund, gift_buy. */
  type: string;
  status: TxStatus;
  direction: "in" | "out";
  title: string;
  subtitle: string;
  source: Money;
  destination?: Money;
  fee?: Money;
  usdValue: Amount;
  journalEntryId?: string;
  quoteId?: string;
  failureReason?: string;
  meta: Record<string, unknown>;
  createdAt: string;
  completedAt?: string;
};

export type JournalEntry = {
  id: string;
  reference: string;
  transactionType: string;
  description: string;
  status: string;
  reversesEntryId?: string;
  businessTransactionId?: string;
  createdBy: string;
  metadata: Record<string, unknown>;
  accountingDate: string;
  postedAt: string;
};

export type JournalLeg = {
  id: number;
  journalEntryId: string;
  ledgerAccountId: number;
  asset: AssetCode;
  side: "debit" | "credit";
  amount: Amount;
  usdRate: string | null;
  ngnRate: string | null;
  memo: string;
  accountNumber: string;
  accountName: string;
  accountCategory: string;
  createdAt: string;
};

export type JournalView = { entry: JournalEntry; legs: JournalLeg[] };

/** One hop of a conversion route (e.g. USD → NGN, NGN → GBP). */
export type SwapLeg = {
  step: number;
  fromAsset: AssetCode;
  toAsset: AssetCode;
  from: Amount;
  to: Amount;
  rate: string;
  providerId: string;
  viaNgnRail: boolean;
  createdAt: string;
};

export type TxDetail = { tx: TxRow; customer: CustomerRow | null; journal: JournalView[]; swapLegs: SwapLeg[] };

// ── Ledger ─────────────────────────────────────────────────
export type LedgerAccount = {
  id: number;
  accountNumber: string;
  ownerKey: string;
  code: string;
  name: string;
  category: string;
  normalSide: "debit" | "credit";
  asset: AssetCode;
  userId?: string;
  accountType: string;
  allowNegative: boolean;
  status: string;
  balance: Amount;
  createdAt: string;
};

export type LedgerSnapshot = {
  id: number;
  ledgerAccountId: number;
  date: string;
  accountNumber: string;
  accountName: string;
  asset: AssetCode;
  closing: Amount;
  lastJournalLegId: number;
  createdAt: string;
};

// ── Treasury (inventory funding, two-person check) ─────────
export type FundingStatus = "pending" | "approved" | "rejected";

export type TreasuryFunding = {
  id: string;
  asset: AssetCode;
  amount: Amount;
  externalReference: string;
  note: string;
  status: FundingStatus;
  requestedBy: string;
  requestedByName: string;
  approvedBy?: string;
  approvedByName?: string;
  decidedAt?: string;
  rejectionReason?: string;
  journalEntryId?: string;
  createdAt: string;
};

// ── Manual customer credits & debits (two-person, super admin approves) ─
export type AdjustmentKind = "credit" | "debit";

export type CustomerAdjustment = {
  id: string;
  kind: AdjustmentKind;
  customerId: string;
  customerName: string;
  customerTag: string;
  asset: AssetCode;
  amount: Amount;
  reason: string;
  status: FundingStatus;
  requestedBy: string;
  requestedByName: string;
  approvedByName?: string;
  decidedAt?: string;
  rejectionReason?: string;
  transactionId?: string;
  journalEntryId?: string;
  createdAt: string;
};

/** Per currency: the vault, what customers are owed, and the difference admins may credit (can be negative). */
export type FreeFunds = { asset: AssetCode; vault: Amount; owed: Amount; free: Amount };

// ── Pricing: rate margins (per asset) + transaction fees (per type) ─
export type RateMargin = { asset: AssetCode; buyPct: string; sellPct: string; version: number; updatedBy: string; updatedAt: string };

export type TransactionFee = {
  type: string;
  category: TxCategory;
  feePct: string;
  flatFee: string;
  flatFeeAsset: AssetCode;
  /** Cap on the fee, in flatFeeAsset. null = no cap. */
  maxFee: string | null;
  active: boolean;
  version: number;
  updatedBy: string;
  updatedAt: string;
};

// ── Rates ──────────────────────────────────────────────────
export type LiveRate = { asset: AssetCode; usd: string; ngn: string; changePct: string };
export type RatesSnapshot = { version: number; collectedAt: string; isStale: boolean; rates: LiveRate[] };
export type RatePoint = { usd: string; ngn: string; at: string };

// ── Service switches ───────────────────────────────────────
/** One customer-facing service an admin can switch off (swap, sends, bills, cards…). */
export type ServiceSwitch = {
  code: string;
  name: string;
  description: string;
  enabled: boolean;
  /** what the app shows while it is off ("" = the default message) */
  disabledMessage: string;
  version: number;
  updatedAt: string;
};

// ── Providers & card designs ───────────────────────────────
export type Provider = {
  id: string;
  slug: string;
  name: string;
  category: string;
  usesNgnRail: boolean;
  supportsDirectConversion: boolean;
  isSimulator: boolean;
  enabled: boolean;
  assets: AssetCode[];
  version: number;
  updatedAt: string;
};

export type CardDesignKind = "theme" | "swatch" | "pattern";
export type CardDesign = {
  id: string;
  kind: CardDesignKind;
  name: string;
  finish: string;
  hexColor: string | null;
  pattern: string | null;
  enabled: boolean;
  sortOrder: number;
  version: number;
  updatedAt: string;
};

// ── Jobs ───────────────────────────────────────────────────
export type CronRun = { id: number; job: string; window: string; status: string; message: string; startedAt: string; finishedAt: string | null };
export type QueueInfo = { name: string; pending: number; active: number; scheduled: number; retry: number; failed: number; processedToday: number };
export type FailedJob = { id: string; queue: string; type: string; error: string; failedAt: string };
export type Jobs = { schedule: { name: string; cron: string }[]; cronRuns: CronRun[]; queues: QueueInfo[]; failed: FailedJob[] };

// ── API trail ──────────────────────────────────────────────
export type ApiRequest = {
  id: string;
  requestId: string;
  actorType: string;
  customerId?: string;
  method: string;
  path: string;
  status: number;
  latencyMs: number;
  ip: string;
  device: string;
  at: string;
  txId?: string;
  request?: string;
  error?: string;
};

// ── Support (tickets + in-app chat) ────────────────────────
export type SupportMessage = { id: string; from: "customer" | "agent" | "system"; author: string; body: string; at: string };
export type ThreadStatus = "open" | "pending" | "resolved";
export type SupportThread = {
  id: string;
  customerId: string;
  customerName: string;
  customerTag: string;
  channel: "ticket" | "chat";
  subject: string;
  txId?: string;
  status: ThreadStatus;
  priority: "normal" | "high" | "urgent";
  unread: number;
  preview: string;
  createdAt: string;
  updatedAt: string;
};

// ── Admins & audit ─────────────────────────────────────────
export type AuditEvent = {
  id: string;
  adminId: string;
  adminName: string;
  action: string;
  target: string;
  summary: string;
  before?: string;
  after?: string;
  at: string;
};
