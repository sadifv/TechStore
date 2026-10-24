const STAFF_ROLES = Object.freeze(['admin', 'owner']);
const isStaff = (role) => STAFF_ROLES.includes(role);

module.exports = { STAFF_ROLES, isStaff };
