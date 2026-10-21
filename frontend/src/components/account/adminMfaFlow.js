export function getAdminMfaStep(response) {
  if (response?.mfaEnrollmentRequired) return 'enroll';
  if (response?.mfaRequired) return 'verify';
  return null;
}
