import { ApplicationStatus, Role, UserRef } from '../api/models';

/**
 * What a user may do, as pure functions. The UI uses these to hide controls;
 * the API enforces the same rules (mock-api/server.mjs), so hiding is a
 * convenience, never the security boundary.
 */
interface AppAccessInfo {
  status: ApplicationStatus;
  createdBy: { id: string };
  assignedReviewer: { id: string } | null;
}

const hasRole = (user: UserRef | null, role: Role): user is UserRef => user?.role === role;
const isOwner = (user: UserRef | null, app: AppAccessInfo) =>
  hasRole(user, 'SALES') && app.createdBy.id === user.id;
const isAssignedReviewer = (user: UserRef | null, app: AppAccessInfo) =>
  hasRole(user, 'REVIEWER') && app.assignedReviewer?.id === user.id;

export const canCreateApplication = (user: UserRef | null) => hasRole(user, 'SALES');

export const canEditApplication = (user: UserRef | null, app: AppAccessInfo) =>
  isOwner(user, app) && app.status === 'DRAFT';

export const canRecordDecision = (user: UserRef | null, app: AppAccessInfo) =>
  isAssignedReviewer(user, app) && (app.status === 'SUBMITTED' || app.status === 'IN_REVIEW');

export const canManageAssignments = (user: UserRef | null, app?: AppAccessInfo) =>
  hasRole(user, 'ADMIN') && (!app || app.status === 'SUBMITTED' || app.status === 'IN_REVIEW');

export const canRevealSensitive = (user: UserRef | null, app: AppAccessInfo) =>
  hasRole(user, 'ADMIN') || isOwner(user, app) || isAssignedReviewer(user, app);
