// @ts-check

export function buildDistrictDemoPayload(){
  const boundarySetId = "county_2024";
  const crosswalkVersionId = "cw_county_2024_demo";
  const censusDatasetId = "acs5_county_2024_demo";
  const electionDatasetId = "mit_county_2024_demo";

  const dataCatalog = {
    boundarySets: [
      {
        id: boundarySetId,
        label: "NJ County 2024",
        geographyType: "COUNTY",
        stateFips: "34",
        vintage: "2024",
        source: "demo",
        isVerified: true,
        isLatest: true,
      },
    ],
    crosswalks: [
      {
        id: crosswalkVersionId,
        fromBoundarySetId: "precinct_2024",
        toBoundarySetId: boundarySetId,
        unit: "tract",
        method: "population",
        source: "demo",
        quality: {
          coveragePct: 100,
          unmatchedPct: 0,
          weightDriftPct: 0,
          isVerified: true,
        },
        isLatest: true,
      },
    ],
    censusDatasets: [
      {
        id: censusDatasetId,
        kind: "census",
        label: "ACS5 Essex Demo 2024",
        source: "census_demo",
        vintage: "2024",
        boundarySetId,
        stateFips: "34",
        countyFips: "013",
        granularity: "tract",
        quality: {
          coveragePct: 100,
          isVerified: true,
        },
        isLatest: true,
      },
    ],
    electionDatasets: [
      {
        id: electionDatasetId,
        kind: "election",
        label: "Essex Demo Election 2024",
        source: "election_demo",
        vintage: "2024",
        electionDate: "2024-11-05T00:00:00.000Z",
        officeType: "county",
        raceType: "local",
        cycleYear: 2024,
        boundarySetId,
        stateFips: "34",
        countyFips: "013",
        granularity: "precinct",
        quality: {
          coveragePct: 100,
          isVerified: true,
        },
        isLatest: true,
      },
    ],
    activeBoundarySetId: boundarySetId,
    activeCrosswalkVersionId: crosswalkVersionId,
  };

  const censusManifest = {
    id: censusDatasetId,
    label: "ACS5 Essex Demo 2024",
    source: "census_demo",
    vintage: "2024",
    boundarySetId,
    granularity: "tract",
    rowCount: 3,
    variableRefs: [
      "pop",
      "housing_units",
      "BA_share",
      "INTPTLAT",
      "INTPTLON",
    ],
    quality: {
      coveragePct: 100,
      isVerified: true,
    },
  };

  const electionManifest = {
    id: electionDatasetId,
    label: "Essex Demo Election 2024",
    source: "election_demo",
    vintage: "2024",
    electionDate: "2024-11-05",
    officeType: "county",
    raceType: "local",
    cycleYear: 2024,
    boundarySetId,
    granularity: "precinct",
    rowCount: 4,
    candidateIds: ["Candidate A", "Candidate B"],
    quality: {
      coveragePct: 100,
      isVerified: true,
    },
  };

  const crosswalkRows = [
    { precinctId: "P-001", geoid: "34013000100", weight: 1 },
    { precinctId: "P-002", geoid: "34013000300", weight: 1 },
    { precinctId: "P-003", geoid: "34013000500", weight: 0.55 },
    { precinctId: "P-003", geoid: "34013000300", weight: 0.45 },
    { precinctId: "P-004", geoid: "34013000500", weight: 1 },
  ];

  const precinctResults = [
    { precinctId: "P-001", candidateVotes: { "Candidate A": 640, "Candidate B": 560 } },
    { precinctId: "P-002", candidateVotes: { "Candidate A": 480, "Candidate B": 520 } },
    { precinctId: "P-003", candidateVotes: { "Candidate A": 410, "Candidate B": 390 } },
    { precinctId: "P-004", candidateVotes: { "Candidate A": 300, "Candidate B": 450 } },
  ];

  const censusGeoRows = [
    {
      geoid: "34013000100",
      values: {
        pop: 8200,
        housing_units: 3000,
        BA_share: 36.2,
        INTPTLAT: 40.7452,
        INTPTLON: -74.1926,
      },
    },
    {
      geoid: "34013000300",
      values: {
        pop: 10750,
        housing_units: 4025,
        BA_share: 29.8,
        INTPTLAT: 40.7348,
        INTPTLON: -74.1739,
      },
    },
    {
      geoid: "34013000500",
      values: {
        pop: 9650,
        housing_units: 3680,
        BA_share: 24.1,
        INTPTLAT: 40.7216,
        INTPTLON: -74.2064,
      },
    },
  ];

  return {
    area: {
      type: "COUNTY",
      stateFips: "34",
      district: "",
      countyFips: "34013",
      placeFips: "",
      label: "Essex County, NJ",
    },
    resolution: "tract",
    dataRefs: {
      mode: "pinned_verified",
      boundarySetId,
      crosswalkVersionId,
      censusDatasetId,
      electionDatasetId,
      electionStrictSimilarity: false,
      electionMaxYearDelta: 8,
      electionMinCoveragePct: 90,
    },
    dataCatalog,
    censusManifest,
    electionManifest,
    crosswalkRows,
    precinctResults,
    censusGeoRows,
  };
}
