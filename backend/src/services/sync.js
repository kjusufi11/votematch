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

  // Recalculate stats from the votes now in the DB
  try {
    await updatePoliticianStats(bioguideId);
  } catch (err) {
    console.warn(`Could not update stats for ${bioguideId}:`, err.message);
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
// Note: total_votes / missed_votes_pct / party_loyalty_pct are intentionally
// omitted from the ON CONFLICT update — they are managed by updatePoliticianStats()
// which calculates them from the votes table after each vote sync.

async function upsertMember(m) {
  await db.query(`
    INSERT INTO politicians (
      id, full_name, first_name, last_name, party, state, chamber, district,
      title, in_office, url, total_votes, missed_votes_pct, party_loyalty_pct, last_synced
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,0,0,0,NOW())
    ON CONFLICT (id) DO UPDATE SET
      full_name=$2, first_name=$3, last_name=$4,
      party=$5, state=$6, chamber=$7, district=$8,
      title=$9, in_office=$10, url=$11,
      last_synced=NOW()
  `, [
    m.id, m.full_name, m.first_name, m.last_name,
    m.party, m.state, m.chamber, m.district,
    m.title, m.in_office, m.url,
  ]);
}

// ── Calculate stats from votes table ─────────────────────────────────────────
// Called after vote sync so the politicians row has accurate numbers.

async function updatePoliticianStats(bioguideId) {
  // Total votes cast and abstentions
  const countResult = await db.query(`
    SELECT
      COUNT(*)                                         AS total_votes,
      COUNT(*) FILTER (WHERE position = 'Not Voting') AS not_voting
    FROM votes
    WHERE politician_id = $1
  `, [bioguideId]);

  const totalVotes = parseInt(countResult.rows[0].total_votes) || 0;
  const notVoting  = parseInt(countResult.rows[0].not_voting)  || 0;
  const missedPct  = totalVotes > 0 ? Math.round((notVoting / totalVotes) * 100) : 0;

  // Party loyalty: compare this politician's Yes/No votes against the majority
  // position of other same-party members on the same roll calls.
  // Requires at least some other party members to have been synced.
  const loyaltyResult = await db.query(`
    WITH pol_party AS (
      SELECT party FROM politicians WHERE id = $1
    ),
    pol_votes AS (
      SELECT vote_id, position
      FROM votes
      WHERE politician_id = $1 AND position IN ('Yes', 'No')
    ),
    other_party_votes AS (
      SELECT v.vote_id, v.position
      FROM votes v
      JOIN politicians p ON p.id = v.politician_id
      WHERE p.party = (SELECT party FROM pol_party)
        AND p.id != $1
        AND v.position IN ('Yes', 'No')
        AND v.vote_id IN (SELECT vote_id FROM pol_votes)
    ),
    party_majority AS (
      SELECT
        vote_id,
        CASE WHEN COUNT(*) FILTER (WHERE position = 'Yes') >=
                  COUNT(*) FILTER (WHERE position = 'No')
        THEN 'Yes' ELSE 'No' END AS majority_pos
      FROM other_party_votes
      GROUP BY vote_id
    )
    SELECT
      ROUND(
        COUNT(*) FILTER (WHERE pv.position = pm.majority_pos) * 100.0
          / NULLIF(COUNT(*), 0)
      )::int  AS loyalty_pct,
      COUNT(*) AS votes_with_data
    FROM pol_votes pv
    JOIN party_majority pm ON pm.vote_id = pv.vote_id
  `, [bioguideId]);

  const loyaltyRow    = loyaltyResult.rows[0];
  const votesWithData = parseInt(loyaltyRow?.votes_with_data) || 0;
  const loyaltyPct    = (loyaltyRow?.loyalty_pct != null && votesWithData >= 5)
    ? parseInt(loyaltyRow.loyalty_pct)
    : null;

  if (loyaltyPct !== null) {
    await db.query(`
      UPDATE politicians SET
        total_votes       = $2,
        missed_votes_pct  = $3,
        party_loyalty_pct = $4
      WHERE id = $1
    `, [bioguideId, totalVotes, missedPct, loyaltyPct]);
  } else {
    await db.query(`
      UPDATE politicians SET
        total_votes      = $2,
        missed_votes_pct = $3
      WHERE id = $1
    `, [bioguideId, totalVotes, missedPct]);
  }

  return { totalVotes, missedPct, loyaltyPct, votesWithData };
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

module.exports = {
  syncMembers,
  syncSingleMember,
  syncVotesForPolitician,
  syncRepresentatives,
  updatePoliticianStats,
  CURRENT_CONGRESS,
};
