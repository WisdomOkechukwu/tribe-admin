// Domain model for the admin console. Mirrors tribe-mobile/src (data/seed.ts,
// stores/*, services/kyc.ts) and adds what only ops needs: multi-leg ledgers,
// provider inventory, markups, the API trail and the admin audit log.
// Amounts are in major units, rounded to each asset's precision (lib/domain/assets.ts).

export type AssetCode =
  | "NGN" | "USD" | "GBP" | "EUR" | "KES" | "GHS" | "CAD"
  | "BTC" | "ETH" | "USDT" | "USDC" | "SOL";

export type Money = { asset: AssetCode; amount: number };

// ── Customers ──────────────────────────────────────────────
export type KycTier = 0 | 1 | 2 | 3;
export type KycStatus = "none" | "pending" | "approved" | "failed";
export type CustomerStatus = "active" | "frozen" | "closed";

export type Device = {
  id: string;
  name: string;
  os: string;
  ip: string;
  lastActive: string;
  current: boolean;
  trusted: boolean;
};

export type Beneficiary = {
  id: string;
  kind: "tribe" | "bank" | "wallet";
  name: string;
  handle: string;
  asset: AssetCode;
  network?: string;
};

export type VirtualCard = {
  id: string;
  label: string;
  network: "visa" | "mastercard";
  last4: string;
  currency: "USD";
  balance: number;
  frozen: boolean;
  monthlyLimit: number;
  spentThisMonth: number;
  createdAt: string;
};

export type RecurringBill = {
  id: string;
  billerId: string;
  target: string;
  amountNgn: number;
  payWith: AssetCode;
  frequency: "weekly" | "biweekly" | "monthly";
  nextRun: string;
  active: boolean;
  lastPaid?: string;
};

export type VaultToken = {
  id: string;
  provider: "PHED";
  meter: string;
  amount: number;
  kwh: number;
  token: string;
  bought: string;
  loadedOn: string | null;
};

export type SupportTicket = {
  id: string;
  txId?: string;
  reason: string;
  status: "open" | "resolved";
  createdAt: string;
};

export type Customer = {
  id: string;
  firstName: string;
  lastName: string;
  tag: string;
  email: string;
  phone: string;
  country: string;
  dob: string;
  address: string;
  createdAt: string;
  lastActiveAt: string;
  status: CustomerStatus;
  labels: string[];
  kycTier: KycTier;
  kycStatus: KycStatus;
  globalAccounts: "none" | "review" | "ready";
  balances: Partial<Record<AssetCode, number>>;
  opened: AssetCode[];
  security: { biometrics: boolean; twoFactor: boolean; pinSet: boolean; lockFails: number };
  devices: Device[];
  beneficiaries: Beneficiary[];
  cards: VirtualCard[];
  recurring: RecurringBill[];
  vault: VaultToken[];
  referral: { code: string; referredBy?: string; invited: number; earning: number; earnedNgn: number };
  tickets: SupportTicket[];
};

/** Lightweight row for lists, so tables never ship whole profiles. */
export type CustomerRow = Pick<
  Customer,
  "id" | "firstName" | "lastName" | "tag" | "email" | "phone" | "country" | "createdAt" | "lastActiveAt" | "status" | "labels" | "kycTier" | "kycStatus"
> & { totalUsd: number; txCount: number };

// ── Verifications (QoreID) ─────────────────────────────────
export type VerificationCheck = "bvn" | "dob" | "nin" | "liveness" | "id_document" | "address";
export type VerificationStatus = "pending" | "approved" | "failed" | "cancelled";

/** A KYC image (served by the auth-gated /kyc-media route). */
export type KycMediaKind = "selfie" | "liveness_frame" | "bvn_photo" | "nin_photo" | "id_front" | "id_back" | "proof_of_address";
export type KycMedia = { id: string; kind: KycMediaKind; label: string };

export type Verification = {
  id: string;
  customerId: string;
  tier: 1 | 2 | 3;
  check: VerificationCheck;
  provider: "QoreID";
  reference: string;
  status: VerificationStatus;
  documentType?: string;
  documentMasked?: string;
  matchScore?: number;
  submittedAt: string;
  decidedAt?: string;
  decidedBy?: string;
  reason?: string;
  media: KycMedia[];
};

// ── Transactions ───────────────────────────────────────────
export type TxCategory = "currency" | "virtual_card" | "cashpoint" | "utility" | "giftcard";

export type TxType =
  | "swap" | "deposit" | "withdrawal" | "send" | "receive"
  | "card_create" | "card_fund" | "card_spend" | "card_withdraw" | "card_refund" | "card_chargeback"
  | "cashpoint_create" | "cashpoint_redeem" | "cashpoint_cancel"
  | "airtime" | "data" | "tv" | "electricity"
  | "giftcard_buy" | "giftcard_sell";

export type TxStatus = "completed" | "pending" | "failed" | "cancelled" | "reversed";

export type LegKind =
  | "debit_wallet" | "credit_wallet" | "convert" | "fee"
  | "provider_payout" | "provider_purchase" | "provider_collect"
  | "card_load" | "card_unload" | "escrow_hold" | "escrow_release";

export type InventoryMovement = {
  poolId: string;
  delta: number;
  before: number;
  after: number;
};

/** A customer-side balance change (wallet or virtual card), with before/after. */
export type BalanceMovement = {
  customerId: string;
  account: "wallet" | "card";
  asset: AssetCode;
  cardId?: string;
  cardLast4?: string;
  delta: number;
  before: number;
  after: number;
};

export type Leg = {
  seq: number;
  kind: LegKind;
  label: string;
  from?: Money;
  to?: Money;
  baseRate?: number;
  appliedRate?: number;
  rateMarkupPct?: number;
  fee?: Money;
  provider?: string;
  providerRef?: string;
  status: "completed" | "pending" | "failed" | "reversed";
  at: string;
  /** System side: provider pool balances. */
  inventory: InventoryMovement[];
  /** Customer side: wallet / card balances. */
  balances: BalanceMovement[];
};

export type Transaction = {
  id: string;
  reference: string;
  customerId: string;
  category: TxCategory;
  type: TxType;
  status: TxStatus;
  direction: "in" | "out";
  title: string;
  source: Money;
  destination?: Money;
  fee: Money;
  /** Revenue kept from rate + fee markups, in NGN for comparability. */
  markupRevenueNgn: number;
  usdValue: number;
  createdAt: string;
  failureReason?: string;
  /** Asset → NGN book → … → destination, as shown on every transaction. */
  route: import("./catalog").RouteStep[];
  meta: {
    cashpointCode?: string;
    billerId?: string;
    target?: string;
    plan?: string;
    token?: string;
    units?: number;
    giftBrand?: string;
    giftFaceUsd?: number;
    cardId?: string;
    cardLast4?: string;
    merchant?: string;
    network?: string;
    channel?: string;
    counterparty?: string;
    recurringId?: string;
  };
  legs: Leg[];
};

/** Row shape for lists; legs stay on the server until the detail page. */
export type TxRow = Omit<Transaction, "legs"> & { legCount: number; customerName: string; customerTag: string };

// ── Inventory ──────────────────────────────────────────────
export type InventoryPool = {
  id: string;
  /** "book" = an NGN book (Local NGN, Crypto NGN…); "asset" = custody/FX pool. */
  kind: "book" | "asset";
  /** Display name: "Crypto NGN", "BTC" or "Global FX partner · GBP". */
  label: string;
  /** Can admins add funds to it? (all NGN books except Cashpoint NGN). */
  topup: boolean;
  providerId: string;
  provider: string;
  purpose: string;
  asset: AssetCode;
  balance: number;
  lowThreshold: number;
  updatedAt: string;
};

export type InventoryEntryKind = "topup" | "deduction" | "credit" | "adjustment";

export type InventoryEntry = {
  id: string;
  poolId: string;
  kind: InventoryEntryKind;
  delta: number;
  before: number;
  after: number;
  txId?: string;
  externalRef?: string;
  note?: string;
  adminId?: string;
  at: string;
  /** Top-ups: NGN that funded it, the NGN→asset rate, and the other side's pool. */
  fundedNgn?: number;
  rate?: number;
  linkedPoolId?: string;
};

// ── Markups ────────────────────────────────────────────────
export type MarkupRule = {
  txType: TxType;
  category: TxCategory;
  ratePct: number;
  feePct: number;
  flatFee: number;
  flatFeeAsset: AssetCode;
  active: boolean;
  updatedAt: string;
  updatedBy: string;
};

// ── API trail ──────────────────────────────────────────────
export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export type ApiRequest = {
  id: string;
  requestId: string;
  customerId?: string;
  method: HttpMethod;
  path: string;
  status: number;
  latencyMs: number;
  ip: string;
  device: string;
  at: string;
  txId?: string;
  request?: string;
  response?: string;
  error?: string;
};

// ── Support (tickets + in-app chat) ────────────────────────
export type SupportMessage = { id: string; from: "customer" | "agent" | "system"; author: string; body: string; at: string };
export type ThreadStatus = "open" | "pending" | "resolved";
export type SupportThread = {
  id: string;
  customerId: string;
  channel: "ticket" | "chat";
  subject: string;
  txId?: string;
  status: ThreadStatus;
  priority: "normal" | "high" | "urgent";
  createdAt: string;
  updatedAt: string;
  /** Monotonic activity order, so new events always float to the top. */
  activity: number;
  unread: number;
  messages: SupportMessage[];
};

// ── Admins & audit ─────────────────────────────────────────

export type AuditAction =
  | "login" | "logout" | "inventory.topup" | "markup.update"
  | "kyc.approve" | "kyc.reject" | "customer.freeze" | "customer.unfreeze" | "customer.labels"
  | "support.reply" | "support.status"
  | "team.add" | "team.update" | "team.suspend" | "team.reactivate" | "team.reset" | "team.remove";

export type AuditEvent = {
  id: string;
  adminId: string;
  adminName: string;
  action: AuditAction;
  target: string;
  summary: string;
  before?: string;
  after?: string;
  at: string;
};

export type Page<T> = { rows: T[]; total: number; page: number; pageSize: number; pages: number };
