import {
  ADMIN,
  OTHER_REVIEWER,
  OTHER_SALES,
  REVIEWER,
  SALES,
  makeDetail,
} from '../../../testing/test-helpers';
import {
  canCreateApplication,
  canEditApplication,
  canManageAssignments,
  canRecordDecision,
  canRevealSensitive,
} from './permissions';

describe('permissions', () => {
  const draft = makeDetail({ status: 'DRAFT', assignedReviewer: null });
  const inReview = makeDetail({ status: 'IN_REVIEW' });
  const approved = makeDetail({ status: 'APPROVED' });

  it('only sales can create applications', () => {
    expect(canCreateApplication(SALES)).toBe(true);
    expect(canCreateApplication(REVIEWER)).toBe(false);
    expect(canCreateApplication(ADMIN)).toBe(false);
    expect(canCreateApplication(null)).toBe(false);
  });

  it('only the creator can edit, and only while it is a draft', () => {
    expect(canEditApplication(SALES, draft)).toBe(true);
    expect(canEditApplication(OTHER_SALES, draft)).toBe(false);
    expect(canEditApplication(SALES, inReview)).toBe(false);
    expect(canEditApplication(ADMIN, draft)).toBe(false);
  });

  it('only the assigned reviewer can decide, and only while under review', () => {
    expect(canRecordDecision(REVIEWER, inReview)).toBe(true);
    expect(canRecordDecision(OTHER_REVIEWER, inReview)).toBe(false);
    expect(canRecordDecision(REVIEWER, approved)).toBe(false);
    expect(canRecordDecision(SALES, inReview)).toBe(false);
    expect(canRecordDecision(ADMIN, inReview)).toBe(false);
  });

  it('admins manage assignments for applications awaiting a decision', () => {
    expect(canManageAssignments(ADMIN)).toBe(true);
    expect(canManageAssignments(ADMIN, inReview)).toBe(true);
    expect(canManageAssignments(ADMIN, approved)).toBe(false);
    expect(canManageAssignments(REVIEWER, inReview)).toBe(false);
  });

  it('sensitive values can be revealed by admins, the owner and the assigned reviewer only', () => {
    expect(canRevealSensitive(ADMIN, inReview)).toBe(true);
    expect(canRevealSensitive(SALES, inReview)).toBe(true);
    expect(canRevealSensitive(REVIEWER, inReview)).toBe(true);
    expect(canRevealSensitive(OTHER_SALES, inReview)).toBe(false);
    expect(canRevealSensitive(OTHER_REVIEWER, inReview)).toBe(false);
  });
});
