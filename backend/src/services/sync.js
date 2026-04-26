// src/services/sync.js
// Syncs politicians and votes from congress.gov into our database

const congress = require('./congress');
const db = require('../db');

const CURRENT_CONGRESS = congress.CURRENT_CONGRESS;

// ── Sync all members of a chamber ────────────────────────────────────────────

async function syncMembers(chamber = 'both') {
  const chambers = chamber === 'both' ? ['senate', 'house'] : [chamber];
  let total = 0;

  for (const ch of chambers) {
    console.log(`  Syncing ${ch} members...`);
    try {
      const members = await congress.getMembers(CURRENT_CONGRESS, ch);
      for (const m of members) {
        const normalized = congress.normalizeMember(m);
        await upsertMember(normalized);
        total++;
      }
      console.log(`    ✓ Synced ${members.length} ${ch} members`);
    } catch (err) {
      console.warn(`  Failed to sync ${ch}:`, err.message);
    }
  }
  return total;
}

// ── Sync a single member's profile ───────────────────────────────────────────

async function syncSingleMember(bioguideId) {
  // Skip if recently synced
  const existing = await db.query('SELECT last_synced FROM politicians WHERE id = $1', [bioguideId]);
  const lastSynced = existing.rows[0]?.last_synced;
  if (lastSynced && (Date.now() - new Date(lastSynced)) < 24 * 3600 * 1000) return;

  try {
    const member = await congress.getMember(bioguideId);
    if (!member) return;
    const normalized = congress.normalizeMember(member);
    await upsertMember(normalized);
  } catch (err) {
    console.warn(`Could not sync member ${bioguideId}:`, err.message);
  }

  // Sync their votes
  try {
    await syncVotesForPolitician(bioguideId, 0);
  } catch (err) {
    console.warn(`Could not sync votes for ${bioguideId}:`, err.message);
  }
}

// ── Sync votes for a politician ───────────────────────────────────────────────

async function syncVotesForPolitician(bioguideId, offset = 0) {
  let synced = 0;
  try {
    const votes = await congress.getMemberVotes(bioguideId, offset);
    for (const vote of votes) {
      const normalized = congress.normalizeVote(vote, bioguideId);

      // Upsert bill if available
      let billId = null;
      if (vote.bill?.number && vote.bill?.type) {
        billId = `${vote.bill.type.toLowerCase()}${vote.bill.number}-${vote.congress || CURRENT_CONGRESS}`;
        await db.query(`
          INSERT INTO bills (id, number, title, primary_subject, congress)
          VALUES ($1, $2, $3, $4, $5)
          ON CONFLICT (id) DO NOTHING
        `, [
          billId,
          vote.bill.number,
          vote.description || vote.question || 'Unknown',
          vote.subject || null,
          vote.congress || CURRENT_CONGRESS,
        ]).catch(() => {});
      }

      await db.query(`
        INSERT INTO votes (politician_id, bill_id, vote_id, position, question, description, vote_date, session, congress)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        ON CONFLICT (politician_id, vote_id) DO NOTHING
      `, [
        normalized.politician_id, billId, normalized.vote_id,
        normalized.position, normalized.question, normalized.description,
        normalized.vote_date, normalized.session, normalized.congress,
      ]).catch(() => {});

      synced++;
    }
  } catch (err) {
    console.warn(`Vote sync error for ${bioguideId}:`, err.message);
  }
  return synced;
}

// ── Sync representatives for a user's location ───────────────────────────────

async function syncRepresentatives(state, district) {
  const synced = [];

  // Sync senators for this state
  try {
    const senators = await congress.getMembersByState(state, 'senate');
    for (const s of senators) {
      if (s.bioguideId) {
        await syncSingleMember(s.bioguideId);
        synced.push(s.bioguideId);
      }
    }
  } catch (err) {
    console.warn(`Could not sync senators for ${state}:`, err.message);
  }

  // Sync house rep for this district
  if (district) {
    try {
      const reps = await congress.getMembersByState(state, 'house');
      const districtRep = reps.find(r => r.district == district);
      if (districtRep?.bioguideId) {
        await syncSingleMember(districtRep.bioguideId);
        synced.push(districtRep.bioguideId);
      }
    } catch (err) {
      console.warn(`Could not sync rep for ${state}-${district}:`, err.message);
    }
  }

  return synced;
}

// ── Upsert member to DB ───────────────────────────────────────────────────────

async function upsertMember(m) {
  await db.query(`
    INSERT INTO politicians (
      id, full_name, first_name, last_name, party, state, chamber, district,
      title, in_office, url, total_votes, missed_votes_pct, party_loyalty_pct, last_synced
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,NOW())
    ON CONFLICT (id) DO UPDATE SET
      full_name=$2, party=$5, in_office=$10, url=$11,
      total_votes=$12, missed_votes_pct=$13, party_loyalty_pct=$14,
      last_synced=NOW()
  `, [
    m.id, m.full_name, m.first_name, m.last_name,
    m.party, m.state, m.chamber, m.district,
    m.title, m.in_office, m.url,
    m.total_votes || 0, m.missed_votes_pct || 0, m.party_loyalty_pct || 0,
  ]);
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

module.exports = {
  syncMembers,
  syncSingleMember,
  syncVotesForPolitician,
  syncRepresentatives,
  CURRENT_CONGRESS,
};
