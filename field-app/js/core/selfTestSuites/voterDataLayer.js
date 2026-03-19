// @ts-check
import {
  VOTER_LAYER_SCOPING_RULE,
  buildVoterContactHistoryLedger,
  buildVoterUniverseSummary,
  isMaterialCanonicalVoterField,
  normalizeVoterDataState,
  normalizeVoterRows,
} from "../voterDataLayer.js";

/**
 * @param {{
 *   test: (name: string, fn: () => void) => void,
 *   assert: (cond: unknown, msg?: string) => void,
 * }} deps
 */
export function registerVoterDataLayerTests({ test, assert }){
  test("Phase 0.5: VAN adapter normalizes canonical voter rows", () => {
    const inputRows = [
      {
        VoterFileVANID: "1001",
        FirstName: "Ada",
        LastName: "Lovelace",
        PrecinctName: "P-101",
        Tract: "17031010100",
        BlockGroup: "170310101001",
        SupportScore: "72",
        TurnoutScore: "0.61",
        Attempts: "3",
        Conversations: "2",
        LastContactDate: "2026-03-10",
        Party: "DEM",
        BestPhone: "3125551001",
        UnneededAuditBlob: "{\"raw\":true}",
      },
      {
        VoterFileVANID: "1002",
        FirstName: "Grace",
        LastName: "Hopper",
        PrecinctName: "P-102",
        Tract: "17031010200",
        BlockGroup: "170310102001",
        SupportScore: "0.48",
        TurnoutScore: "45",
        Attempts: "1",
        Conversations: "1",
        LastContactDate: "2026-02-11",
        Party: "IND",
        BestPhone: "",
        EmailAddress: "grace@example.com",
      },
    ];

    const out = normalizeVoterRows(inputRows, {
      adapterId: "van",
      campaignId: "il-hd-21",
      officeId: "west",
      sourceId: "van_sync_20260318",
    });

    assert(out.rows.length === 2, "expected two canonical voter rows");
    const first = out.rows[0];
    assert(first.voterId === "1001", "first voter id mismatch");
    assert(first.tractGeoid === "17031010100", "tract geoid mismatch");
    assert(first.blockGroupGeoid === "170310101001", "block group geoid mismatch");
    assert(Math.abs(Number(first.supportScore) - 0.72) < 1e-9, "support score should normalize from pct to unit");
    assert(first.contactAttempts === 3 && first.contactConversations === 2, "contact history counters mismatch");
    assert(first.campaignId === "il-hd-21" && first.officeId === "west", "campaign/office context mismatch");
    assert(
      Number(out.manifest.ignoredHeaderCount) >= 1 && out.manifest.ignoredHeadersSample.includes("UnneededAuditBlob"),
      "lean import should keep traceability for ignored headers without persisting raw payload",
    );
    assert(cleanText(VOTER_LAYER_SCOPING_RULE) === "import_broad_persist_narrow", "voter layer scoping rule drifted");
  });

  test("Phase 0.5: voter row normalization de-dupes voterId and rejects missing IDs", () => {
    const out = normalizeVoterRows([
      { voter_id: "A-1", support_score: "0.55" },
      { voter_id: "A-1", support_score: "0.65" },
      { voter_id: "", support_score: "0.25" },
    ], { adapterId: "canonical" });

    assert(out.rows.length === 1, "expected duplicate voterId rows to collapse");
    assert(out.duplicateCount === 1, "duplicate count mismatch");
    assert(out.rejectedCount === 1, "rejected count mismatch");
    assert(Math.abs(Number(out.rows[0].supportScore) - 0.65) < 1e-9, "latest duplicate should win deterministically");
  });

  test("Phase 0.5: voter universe summary derives canonical counts", () => {
    const summary = buildVoterUniverseSummary([
      { voterId: "v1", supportScore: 0.70, turnoutScore: 0.65, precinctId: "P1", tractGeoid: "17031010100", blockGroupGeoid: "170310101001", contactPhone: "312", party: "DEM" },
      { voterId: "v2", supportScore: 0.50, turnoutScore: 0.45, precinctId: "P2", tractGeoid: "17031010200", blockGroupGeoid: "170310102001", contactEmail: "a@b.com", party: "DEM" },
      { voterId: "v3", supportScore: 0.30, turnoutScore: 0.40, precinctId: "", tractGeoid: "17031010300", blockGroupGeoid: "", contactPhone: "", contactEmail: "", party: "REP" },
      { voterId: "v4", supportScore: 0.52, turnoutScore: 0.80, precinctId: "P4", tractGeoid: "", blockGroupGeoid: "", contactPhone: "773", party: "IND" },
    ]);

    assert(summary.totalVoters === 4, "total voter count mismatch");
    assert(summary.contactableVoters === 3, "contactable voter count mismatch");
    assert(summary.mappedToPrecinct === 3, "precinct mapping count mismatch");
    assert(summary.mappedToTract === 3, "tract mapping count mismatch");
    assert(summary.mappedToBlockGroup === 2, "block-group mapping count mismatch");
    assert(summary.persuasionUniverse === 2, "persuasion-universe count mismatch");
    assert(summary.turnoutOpportunityUniverse === 2, "turnout-opportunity count mismatch");
    assert(summary.strongSupportUniverse === 1, "strong-support count mismatch");
    assert(summary.strongOppositionUniverse === 1, "strong-opposition count mismatch");
    assert(summary.partyMix.DEM === 2 && summary.partyMix.REP === 1 && summary.partyMix.IND === 1, "party mix mismatch");
  });

  test("Phase 0.5: voter contact history ledger is deterministic", () => {
    const ledger = buildVoterContactHistoryLedger([
      {
        voterId: "v1",
        lastContactAt: "2026-03-16T10:00:00.000Z",
        lastContactResult: "Support Identified",
        contactAttempts: 4,
        contactConversations: 2,
      },
      {
        voterId: "v2",
        lastContactAt: "2026-02-20T12:00:00.000Z",
        lastContactResult: "No Answer",
        contactAttempts: 3,
        contactConversations: 0,
      },
      {
        voterId: "v3",
        lastContactAt: "",
        lastContactResult: "",
        contactAttempts: 1,
        contactConversations: 1,
      },
    ], { nowIso: "2026-03-18T00:00:00.000Z", recentWindowDays: 21 });

    assert(ledger.totalRows === 3, "ledger total rows mismatch");
    assert(ledger.withContactTimestamp === 2, "contact timestamp count mismatch");
    assert(ledger.recentlyContacted === 1, "recently contacted mismatch");
    assert(ledger.totalAttempts === 8, "attempt sum mismatch");
    assert(ledger.totalConversations === 3, "conversation sum mismatch");
    assert(ledger.supportIdentifiedCount === 1, "support identified count mismatch");
    assert(Array.isArray(ledger.historyByDate) && ledger.historyByDate.length === 2, "daily ledger rows mismatch");
    assert(ledger.historyByDate[0]?.date === "2026-02-20", "history rows should be date-sorted");
  });

  test("Phase 0.5: voter data state normalization computes canonical summaries", () => {
    const state = normalizeVoterDataState({
      manifest: { adapterId: "canonical", campaignId: "il-hd-21", officeId: "west" },
      rows: [
        { voter_id: "A", support_score: "0.55", turnout_score: "0.45", attempts: "2", conversations: "1", last_contact_date: "2026-03-17" },
        { voter_id: "B", support_score: "0.30", turnout_score: "0.65", attempts: "1", conversations: "0", last_contact_date: "2026-03-01" },
      ],
    });

    assert(Array.isArray(state.rows) && state.rows.length === 2, "normalized voterData rows mismatch");
    assert(Number(state.latestUniverseSummary?.totalVoters) === 2, "latest universe summary should derive from canonical rows");
    assert(Number(state.latestContactLedger?.totalAttempts) === 3, "latest contact ledger should derive from canonical rows");
  });

  test("Phase 0.5: canonical voter material-field gate is deterministic", () => {
    assert(isMaterialCanonicalVoterField("supportScore") === true, "supportScore should be material");
    assert(isMaterialCanonicalVoterField("mysteryField") === false, "unknown fields should not become canonical");
  });
}

/**
 * @param {unknown} value
 * @returns {string}
 */
function cleanText(value){
  return String(value == null ? "" : value).trim();
}
