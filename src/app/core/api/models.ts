export type Role = 'SALES' | 'REVIEWER' | 'ADMIN';

export interface UserRef {
  id: string;
  name: string;
  role: Role;
}

export const APPLICATION_STATUSES = [
  'DRAFT',
  'SUBMITTED',
  'IN_REVIEW',
  'APPROVED',
  'REJECTED',
] as const;
export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];

export const STATUS_LABELS: Record<ApplicationStatus, string> = {
  DRAFT: 'Draft',
  SUBMITTED: 'Awaiting assignment',
  IN_REVIEW: 'In review',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
};

export interface ApplicationSummary {
  id: string;
  reference: string;
  businessName: string;
  category: string;
  status: ApplicationStatus;
  createdBy: UserRef;
  assignedReviewer: UserRef | null;
  expectedMonthlyVolume: number;
  updatedAt: string;
}

export interface BusinessDetails {
  businessName: string;
  legalName: string;
  businessType: string;
  registrationNumber: string;
  panNumber: string;
  category: string;
  website: string;
  expectedMonthlyVolume: number | null;
  averageTicketSize: number | null;
}

export interface ContactDetails {
  ownerName: string;
  ownerIdNumber: string;
  email: string;
  phone: string;
  province: string;
  city: string;
  street: string;
}

export interface BankDetails {
  bankName: string;
  accountHolderName: string;
  accountNumber: string;
}

export interface ApplicationDraft {
  business: Partial<BusinessDetails>;
  contact: Partial<ContactDetails>;
  bank: Partial<BankDetails>;
}

export type SensitiveField = 'panNumber' | 'ownerIdNumber' | 'accountNumber';

export interface ApplicationDetail extends ApplicationSummary {
  createdAt: string;
  submittedAt: string | null;
  business: Partial<BusinessDetails>;
  contact: Partial<ContactDetails>;
  bank: Partial<BankDetails>;
  sensitiveFields: SensitiveField[];
}

export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH';
export type Decision = 'APPROVE' | 'REJECT';

export interface HistoryEntry {
  id: string;
  at: string;
  type: 'SUBMITTED' | 'ASSIGNED' | 'DECISION';
  actor: UserRef;
  note: string;
  decision?: Decision;
  riskLevel?: RiskLevel;
}

export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export type SortKey = 'updatedAt' | 'businessName' | 'volume';

export interface ApplicationQuery {
  page: number;
  pageSize: number;
  status: ApplicationStatus | null;
  search: string;
  sort: SortKey;
  dir: 'asc' | 'desc';
  unassigned: boolean;
}

export interface SaveResult {
  id: string;
  reference: string;
  updatedAt: string;
}

export interface DecisionInput {
  decision: Decision;
  riskLevel: RiskLevel;
  note: string;
}
