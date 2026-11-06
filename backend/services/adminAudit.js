const mongoose = require('mongoose');
const Audit = require('../models/AdminAuditEvent');
const { definitions, validators, fields } = require('./adminAuditPolicy');
// Mongoose propagates the active transaction to every query/save in audited handlers.
// Existing inventory transactions remain independent and record events explicitly in their own session.
mongoose.set('transactionAsyncLocalStorage', true);
const invalid = () =>
  Object.assign(new Error('Filtros de historial inválidos.'), { statusCode: 400 });
function parseAuditQuery(q = {}) {
  if (Object.keys(q).some((k) => !['page', 'limit', 'action', 'from', 'to'].includes(k)))
    throw invalid();
  const integer = (v, d, max) => {
    if (v === undefined) return d;
    if (typeof v !== 'string' || !/^[1-9]\d*$/.test(v) || Number(v) > max) throw invalid();
    return Number(v);
  };
  const page = integer(q.page, 1, 1000),
    limit = integer(q.limit, 20, 50),
    filter = {};
  if (q.action !== undefined && q.action !== '') {
    if (typeof q.action !== 'string' || !Object.hasOwn(definitions, q.action)) throw invalid();
    filter.action = q.action;
  }
  const date = (v) => {
    if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v)) throw invalid();
    const d = new Date(v + 'T00:00:00.000Z');
    if (!Number.isFinite(d.getTime()) || d.toISOString().slice(0, 10) !== v) throw invalid();
    return d;
  };
  const from = q.from ? date(q.from) : null,
    to = q.to ? date(q.to) : null;
  for (const k of ['from', 'to'])
    if (q[k] !== undefined && typeof q[k] !== 'string') throw invalid();
  if (from && to && (to < from || to - from > 366 * 86400000)) throw invalid();
  if (from || to)
    filter.createdAt = {
      ...(from ? { $gte: from } : {}),
      ...(to ? { $lt: new Date(to.getTime() + 86400000) } : {}),
    };
  return { page, limit, filter };
}
function safeChanges(action, value = {}) {
  return (fields[definitions[action]] || [])
    .filter((field) => value[field] !== undefined && validators[field](value[field]))
    .map((field) => ({ field, after: value[field] }));
}
async function recordAudit({ actorId, action, resourceId, value }, session) {
  if (!Object.hasOwn(definitions, action)) throw new Error('Acción de auditoría inválida.');
  return Audit.create(
    [
      {
        actorId,
        action,
        resourceType: definitions[action],
        resourceId: String(resourceId),
        changes: safeChanges(action, value),
      },
    ],
    session ? { session } : {},
  );
}
// Buffer the JSON response: no successful HTTP response can escape before audit and data commit.
function auditedHandler(
  handler,
  action,
  entity = (body) => body.data || body.product || body.order || body.coupon || body.user,
) {
  return async (req, res, next) => {
    try {
      let payload,
        statusCode = 200;
      await mongoose.connection.transaction(
        async (session) => {
          payload = undefined;
          statusCode = 200;
          req.auditContactChanged = false;
          const response = {
            status(code) {
              statusCode = code;
              return this;
            },
            json(body) {
              payload = body;
              return this;
            },
            set(...args) {
              res.set?.(...args);
              return this;
            },
          };
          await handler(req, response, (error) => {
            throw error;
          });
          if (!payload) throw new Error('Respuesta administrativa incompleta.');
          if (statusCode >= 400 || !payload.success)
            throw Object.assign(new Error('Mutación rechazada.'), {
              auditResponse: { payload, statusCode },
            });
          if (statusCode < 400 && payload.success) {
            const value = entity(payload, req);
            if (value === undefined || (value !== null && !value._id && !req.params?.id))
              throw new Error('Recurso de auditoría incompleto.');
            if (value !== null)
              await recordAudit(
                {
                  actorId: req.user?.id || req.session?.user?.id,
                  action,
                  resourceId: value._id || req.params?.id,
                  value,
                },
                session,
              );
          }
        },
        {
          readConcern: { level: 'snapshot' },
          writeConcern: { w: 'majority' },
          maxCommitTimeMS: 5000,
        },
      );
      return res.status(statusCode).json(payload);
    } catch (error) {
      if (error.auditResponse)
        return res.status(error.auditResponse.statusCode).json(error.auditResponse.payload);
      return next(error);
    }
  };
}
async function getAudit(req, res, next) {
  try {
    const { page, limit, filter } = parseAuditQuery(req.query);
    const [events, totalCount, first] = await Promise.all([
      Audit.find(filter)
        .select('_id actorId action resourceType resourceId createdAt changes')
        .sort({ createdAt: -1, _id: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Audit.countDocuments(filter),
      Audit.findOne().sort({ createdAt: 1, _id: 1 }).select('createdAt').lean(),
    ]);
    res.set('Cache-Control', 'no-store');
    return res.json({
      success: true,
      data: {
        events,
        pagination: {
          currentPage: page,
          totalPages: Math.max(1, Math.ceil(totalCount / limit)),
          totalCount,
        },
        startedAt: first?.createdAt || null,
        actions: Object.keys(definitions),
      },
    });
  } catch (error) {
    return next(error);
  }
}
module.exports = { parseAuditQuery, safeChanges, recordAudit, auditedHandler, getAudit };
