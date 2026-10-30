/**
 * Fictitious seed data. Every name, number and email below is generated and
 * does not belong to a real person, business or bank account.
 */

export const USERS = [
  { id: 'u_sales_1', name: 'Asha Gurung (Sales)', role: 'SALES' },
  { id: 'u_sales_2', name: 'Bikram Thapa (Sales)', role: 'SALES' },
  { id: 'u_rev_1', name: 'Mira Shrestha (Reviewer)', role: 'REVIEWER' },
  { id: 'u_rev_2', name: 'Nabin Rai (Reviewer)', role: 'REVIEWER' },
  { id: 'u_admin', name: 'Sujata Karki (Admin)', role: 'ADMIN' },
];

// Small deterministic PRNG so the dataset is the same on every start.
function rng(seed) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

const PREFIXES = [
  'Himal',
  'Sagarmatha',
  'Lumbini',
  'Phewa',
  'Annapurna',
  'Bagmati',
  'Koshi',
  'Gandaki',
  'Rara',
  'Tilicho',
  'Mustang',
  'Janaki',
];
const SUFFIXES = [
  'Traders',
  'Mart',
  'Kitchen',
  'Electronics',
  'Pharmacy',
  'Tours',
  'Handicrafts',
  'Books',
  'Cafe',
  'Outfitters',
];
const CATEGORIES = ['RETAIL', 'FOOD_AND_BEVERAGE', 'TRAVEL', 'ELECTRONICS', 'HEALTH', 'EDUCATION'];
const TYPES = ['SOLE_PROPRIETORSHIP', 'PARTNERSHIP', 'PRIVATE_LIMITED'];
const PROVINCES = ['Koshi', 'Madhesh', 'Bagmati', 'Gandaki', 'Lumbini', 'Karnali', 'Sudurpashchim'];
const CITIES = ['Kathmandu', 'Lalitpur', 'Pokhara', 'Biratnagar', 'Butwal', 'Dharan', 'Bharatpur'];
const BANKS = [
  'Example Commercial Bank',
  'Sample Development Bank',
  'Demo Finance Ltd',
  'Test Investment Bank',
];
const FIRST = ['Ramesh', 'Sunita', 'Kiran', 'Pooja', 'Suman', 'Anita', 'Deepak', 'Rekha'];
const LAST = ['Adhikari', 'Bhandari', 'Magar', 'Tamang', 'Joshi', 'Poudel', 'Lama', 'Yadav'];

export function seedApplications() {
  const r = rng(42);
  const pick = (arr) => arr[Math.floor(r() * arr.length)];
  const digits = (n) => Array.from({ length: n }, () => Math.floor(r() * 10)).join('');
  const reviewers = USERS.filter((u) => u.role === 'REVIEWER');
  const sales = USERS.filter((u) => u.role === 'SALES');
  const statuses = ['DRAFT', 'SUBMITTED', 'IN_REVIEW', 'IN_REVIEW', 'APPROVED', 'REJECTED'];
  const base = Date.parse('2026-10-01T09:00:00Z');

  return Array.from({ length: 48 }, (_, i) => {
    const businessName = `${pick(PREFIXES)} ${pick(SUFFIXES)}`;
    const owner = `${pick(FIRST)} ${pick(LAST)}`;
    const status = statuses[i % statuses.length];
    const creator = sales[i % sales.length];
    const createdAt = new Date(base + i * 7.5 * 3600 * 1000).toISOString();
    const updatedAt = new Date(base + i * 7.5 * 3600 * 1000 + 2 * 3600 * 1000).toISOString();
    const assigned = ['IN_REVIEW', 'APPROVED', 'REJECTED'].includes(status)
      ? reviewers[i % reviewers.length]
      : null;
    const volume = 50000 + Math.floor(r() * 95) * 10000;
    const admin = USERS.find((u) => u.role === 'ADMIN');
    const ref = (u) => ({ id: u.id, name: u.name, role: u.role });

    const history = [];
    if (status !== 'DRAFT') {
      history.push({
        id: `h${i}a`,
        at: createdAt,
        type: 'SUBMITTED',
        actor: ref(creator),
        note: 'Submitted for review.',
      });
    }
    if (assigned) {
      history.push({
        id: `h${i}b`,
        at: updatedAt,
        type: 'ASSIGNED',
        actor: ref(admin),
        note: `Assigned to ${assigned.name}.`,
      });
    }
    if (status === 'APPROVED' || status === 'REJECTED') {
      history.push({
        id: `h${i}c`,
        at: new Date(Date.parse(updatedAt) + 3600 * 1000).toISOString(),
        type: 'DECISION',
        decision: status === 'APPROVED' ? 'APPROVE' : 'REJECT',
        riskLevel: status === 'APPROVED' ? 'LOW' : 'HIGH',
        actor: ref(assigned),
        note:
          status === 'APPROVED'
            ? 'Documents verified, volumes consistent with category.'
            : 'Registration details could not be verified.',
      });
    }

    return {
      id: `app_seed_${String(i + 1).padStart(3, '0')}`,
      reference: `MA-${10001 + i}`,
      status,
      createdBy: creator.id,
      assignedReviewerId: assigned?.id ?? null,
      createdAt,
      updatedAt,
      submittedAt: status === 'DRAFT' ? undefined : createdAt,
      business: {
        businessName,
        legalName: `${businessName} Pvt. Ltd.`,
        businessType: pick(TYPES),
        registrationNumber: `${digits(5)}/${digits(3)}`,
        panNumber: digits(9),
        category: pick(CATEGORIES),
        website: '',
        expectedMonthlyVolume: volume,
        averageTicketSize: 500 + Math.floor(r() * 40) * 100,
      },
      contact: {
        ownerName: owner,
        ownerIdNumber: `${digits(2)}-${digits(2)}-${digits(2)}-${digits(5)}`,
        email: `${owner.split(' ')[0].toLowerCase()}@example.com`,
        phone: `98${digits(8)}`,
        province: pick(PROVINCES),
        city: pick(CITIES),
        street: `Ward ${1 + Math.floor(r() * 30)}`,
      },
      bank: {
        bankName: pick(BANKS),
        accountHolderName: `${businessName} Pvt. Ltd.`,
        accountNumber: digits(14),
      },
      history,
      revealLog: [],
    };
  });
}
