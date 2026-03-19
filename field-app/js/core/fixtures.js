// @ts-check
// js/fixtures.js
// Phase 5.6 — Golden snapshot fixtures (stable regression baselines)
// These are intentionally small, deterministic scenarios to detect drift.

/**
 * @typedef {object} SelfTestFixture
 * @property {string} id
 * @property {string} name
 * @property {Record<string, any>} spec
 * @property {Record<string, any>} expect
 */

/** @type {SelfTestFixture[]} */
export const FIXTURES = [
  {
    "id": "baseline_small",
    "name": "Baseline small race",
    "spec": {
      "modelInput": {
        "universeSize": 50000,
        "turnoutA": 35,
        "turnoutB": 55,
        "bandWidth": 4,
        "candidates": [
          {
            "id": "a",
            "name": "A",
            "supportPct": 35
          },
          {
            "id": "b",
            "name": "B",
            "supportPct": 35
          }
        ],
        "undecidedPct": 30,
        "yourCandidateId": "a",
        "undecidedMode": "proportional",
        "userSplit": {},
        "persuasionPct": 30,
        "earlyVoteExp": 40
      },
      "baseRates": {
        "cr": 0.22,
        "sr": 0.55,
        "tr": 0.8
      },
      "tactics": {
        "doors": {
          "enabled": true,
          "cpa": 0.18
        },
        "phones": {
          "enabled": true,
          "cpa": 0.03
        },
        "texts": {
          "enabled": false,
          "cpa": 0.02
        }
      },
      "overheadAmount": 0,
      "includeOverhead": false,
      "optimize": {
        "mode": "budget",
        "budget": 10000,
        "capacityCeiling": 50000,
        "step": 25
      }
    },
    "expect": {
      "persuasionNeed": 1,
      "turnoutVotes": 22500,
      "winThreshold": 11251,
      "yourVotes": 11250,
      "roi": {
        "totalCost": 2.32,
        "rows": [
          {
            "key": "phones",
            "totalCost": 0.34,
            "costPerNetVote": 0.3374
          },
          {
            "key": "doors",
            "totalCost": 1.98,
            "costPerNetVote": 1.9845
          }
        ]
      },
      "optimize": {
        "totals": {
          "cost": 1633.1,
          "attempts": 50000
        },
        "allocation": {
          "doors": 0,
          "phones": 50000
        }
      }
    }
  },
  {
    "id": "tight_margin",
    "name": "Tight margin higher universe",
    "spec": {
      "modelInput": {
        "universeSize": 120000,
        "turnoutA": 40,
        "turnoutB": 55,
        "bandWidth": 3,
        "candidates": [
          {
            "id": "a",
            "name": "A",
            "supportPct": 33
          },
          {
            "id": "b",
            "name": "B",
            "supportPct": 38
          }
        ],
        "undecidedPct": 29,
        "yourCandidateId": "a",
        "undecidedMode": "proportional",
        "userSplit": {},
        "persuasionPct": 28,
        "earlyVoteExp": 45
      },
      "baseRates": {
        "cr": 0.2,
        "sr": 0.52,
        "tr": 0.78
      },
      "tactics": {
        "doors": {
          "enabled": true,
          "cpa": 0.2
        },
        "phones": {
          "enabled": true,
          "cpa": 0.035
        },
        "texts": {
          "enabled": true,
          "cpa": 0.018
        }
      },
      "overheadAmount": 1500,
      "includeOverhead": true,
      "optimize": {
        "mode": "budget",
        "budget": 7500,
        "capacityCeiling": 30000,
        "step": 25
      }
    },
    "expect": {
      "persuasionNeed": 4015,
      "turnoutVotes": 57000,
      "winThreshold": 30508,
      "yourVotes": 26493,
      "roi": {
        "totalCost": 17826.08,
        "rows": [
          {
            "key": "texts",
            "totalCost": 2375.58,
            "costPerNetVote": 0.5917
          },
          {
            "key": "phones",
            "totalCost": 3386.02,
            "costPerNetVote": 0.8433
          },
          {
            "key": "doors",
            "totalCost": 12064.48,
            "costPerNetVote": 3.0049
          }
        ]
      },
      "optimize": {
        "totals": {
          "cost": 530.71,
          "attempts": 30000
        },
        "allocation": {
          "doors": 0,
          "phones": 0,
          "texts": 30000
        }
      }
    }
  },
  {
    "id": "capacity_bound",
    "name": "Capacity bound",
    "spec": {
      "modelInput": {
        "universeSize": 80000,
        "turnoutA": 30,
        "turnoutB": 50,
        "bandWidth": 5,
        "candidates": [
          {
            "id": "a",
            "name": "A",
            "supportPct": 36
          },
          {
            "id": "b",
            "name": "B",
            "supportPct": 34
          }
        ],
        "undecidedPct": 30,
        "yourCandidateId": "a",
        "undecidedMode": "proportional",
        "userSplit": {},
        "persuasionPct": 32,
        "earlyVoteExp": 35
      },
      "baseRates": {
        "cr": 0.24,
        "sr": 0.58,
        "tr": 0.82
      },
      "tactics": {
        "doors": {
          "enabled": true,
          "cpa": 0.19
        },
        "phones": {
          "enabled": true,
          "cpa": 0.028
        },
        "texts": {
          "enabled": false,
          "cpa": 0.02
        }
      },
      "overheadAmount": 0,
      "includeOverhead": false,
      "optimize": {
        "mode": "capacity",
        "capacity": 2000,
        "step": 25
      }
    },
    "expect": {
      "persuasionNeed": 0,
      "turnoutVotes": 32000,
      "winThreshold": 15544,
      "yourVotes": 16457,
      "roi": {
        "totalCost": 0,
        "rows": [
          {
            "key": "doors",
            "totalCost": null,
            "costPerNetVote": null
          },
          {
            "key": "phones",
            "totalCost": null,
            "costPerNetVote": null
          }
        ]
      },
      "optimize": {
        "totals": {
          "cost": 405.55,
          "attempts": 2000
        },
        "allocation": {
          "doors": 2000,
          "phones": 0
        }
      }
    }
  }
];
