// middleware/authorize.js
// Authorization layer on top of verifyToken (which only AUTHENTICATES).
//
// verifyToken proves "you are a valid logged-in user". These middlewares prove
// "you are allowed to touch THIS record" — closing the IDOR / broken-access-
// control hole where any authenticated user could read another user's data by
// passing their uid in the route param.

const { db } = require('../config/firebase')

// Patient-data routes (/:uid). Allow when the caller IS that user, or is the
// clinician that the target patient is assigned to. Everyone else → 403.
const requireSelfOrAssignedClinician = async (req, res, next) => {
  const callerUid = req.user.uid
  const targetUid = req.params.uid
  if (callerUid === targetUid) return next()
  try {
    const targetDoc = await db.collection('users').doc(targetUid).get()
    if (targetDoc.exists && targetDoc.data().assignedClinician === callerUid) return next()
    return res.status(403).json({ error: 'Forbidden — not authorized for this patient' })
  } catch (e) {
    return res.status(500).json({ error: e.message })
  }
}

// Clinician-only routes. Caller's user doc must have role 'clinician'.
const requireClinician = async (req, res, next) => {
  try {
    const callerDoc = await db.collection('users').doc(req.user.uid).get()
    if (callerDoc.exists && callerDoc.data().role === 'clinician') {
      req.clinician = callerDoc.data()
      return next()
    }
    return res.status(403).json({ error: 'Forbidden — clinician access required' })
  } catch (e) {
    return res.status(500).json({ error: e.message })
  }
}

module.exports = { requireSelfOrAssignedClinician, requireClinician }
