// ============================================================
// Chart Resolver — maps chartId to data fetcher + renderer
// Shared by: /embed/[chartId] and /charts/[chartId]
// ============================================================

import {
  NeighbourhoodBarChart,
  TimeSeriesAreaChart,
  TimeSeriesBarChart,
  MultiSeriesLineChart,
  type MultiSeriesPoint,
} from "@/components/chart";
import { getMunicipality, getLiveMunicipalities } from "@/lib/municipality-registry";
import {
  fetchAssessmentsByGroup,
  fetchBusinessCategories,
  fetchVacantLots,
  fetchPermitsByGroup,
} from "@/lib/municipality-data";
import {
  fetchBoCTimeSeries,
  fetchStatCanTimeSeries,
  fetchAlbertaActivityIndex,
  fetchEdmontonBusinessLicences as fetchEdmontonBusinessLicencesTimeSeries,
  fetchEdmontonPermitsSummary,
  fetchEdmontonCommercialAssessments,
  fetchEdmontonBusinessCategories,
  fetchEdmontonBusinessesByNeighbourhood,
  fetchEdmontonCommercialPermits,
  fetchHotNeighbourhoods,
  fetchTopNeighbourhoodAssessments,
  fetchRedevelopingActivity,
  fetchHomeImprovementHotspots,
  fetchResidentialPermitTrend,
  fetchRoadConstructionByType,
  fetchStrathconaHotSubdivisions,
  fetchStrathconaAssessmentsByArea,
  fetchStAlbertAssessmentsByNeighbourhood,
  fetchClimateMonthly,
  BOC_SERIES,
  STATSCAN_SERIES,
  type TimeSeriesPoint,
} from "@/lib/data-sources";
import {
  fetchRetailSubsectors,
  fetchEcommerceSales,
  fetchFoodServices,
  fetchBusinessDynamics,
  fetchRetailBusinessDynamics,
  fetchFoodBusinessDynamics,
  fetchEdmontonLicenceMonthlyTrend,
} from "@/lib/data-sources-retail";
import {
  fetchCannabisProductQuarterly,
} from "@/lib/data-sources-cannabis";
import {
  fetchHousingStarts,
  fetchHousingCompletions,
  fetchUnderConstruction,
  fetchVacancyRates,
  fetchRentComparison,
  fetchMortgageRate,
} from "@/lib/data-sources-cmhc";
import {
  fetchCrimeByCategory,
  fetchCalgaryMonthlyTrend,
} from "@/lib/data-sources-crime";
import {
  fetchEdmontonFireByType,
  fetchEdmontonFireMonthlyTrend,
} from "@/lib/data-sources-fire";
import {
  fetchAlbertaMajorProjects,
} from "@/lib/data-sources-infrastructure";
import React from "react";

export interface ChartDef {
  title: string;
  source: string;
  render: () => Promise<React.ReactNode>;
}

function municipalityChart(slug: string, type: string): ChartDef | null {
  const config = getMunicipality(slug);
  if (!config) return null;

  switch (type) {
    case "assessment-by-zone":
      return {
        title: `${config.name} — Avg Assessment by Zone`,
        source: config.dataSource,
        render: async () => {
          const data = await fetchAssessmentsByGroup(config, "zoning");
          const chartData = data.slice(0, 15).map((d) => ({
            neighbourhood: d.group,
            avgValue: d.avgAssessment,
          }));
          return React.createElement(NeighbourhoodBarChart, {
            data: chartData,
            dataKey: "avgValue",
            color: config.color,
            valuePrefix: "$",
            tooltipLabel: "Avg Assessment",
            height: 350,
          });
        },
      };

    case "properties-by-zone":
      return {
        title: `${config.name} — Properties by Zone`,
        source: config.dataSource,
        render: async () => {
          const data = await fetchAssessmentsByGroup(config, "zoning");
          const chartData = data.slice(0, 15).map((d) => ({
            neighbourhood: d.group,
            permits: d.count,
          }));
          return React.createElement(NeighbourhoodBarChart, {
            data: chartData,
            dataKey: "permits",
            color: "#3b82f6",
            tooltipLabel: "Properties",
            height: 350,
          });
        },
      };

    case "assessment-by-neighbourhood":
    case "assessment-by-subdivision":
      return {
        title: `${config.name} — Avg Assessment by Area`,
        source: config.dataSource,
        render: async () => {
          const groupBy = config.fields.neighbourhood ? "neighbourhood" : "subdivision";
          const data = await fetchAssessmentsByGroup(config, groupBy);
          const chartData = data
            .sort((a, b) => b.avgAssessment - a.avgAssessment)
            .slice(0, 15)
            .map((d) => ({
              neighbourhood: d.group,
              avgValue: d.avgAssessment,
            }));
          return React.createElement(NeighbourhoodBarChart, {
            data: chartData,
            dataKey: "avgValue",
            color: "#10b981",
            valuePrefix: "$",
            tooltipLabel: "Avg Assessment",
            height: 350,
          });
        },
      };

    case "businesses":
      return {
        title: `${config.name} — Businesses by Category`,
        source: config.dataSource,
        render: async () => {
          const data = await fetchBusinessCategories(config);
          const chartData = data.slice(0, 15).map((d) => ({
            neighbourhood: d.category,
            permits: d.count,
          }));
          return React.createElement(NeighbourhoodBarChart, {
            data: chartData,
            dataKey: "permits",
            color: "#a855f7",
            tooltipLabel: "Businesses",
            height: 350,
          });
        },
      };

    case "vacant":
      return {
        title: `${config.name} — Vacant Lots`,
        source: config.dataSource,
        render: async () => {
          const data = await fetchVacantLots(config);
          const chartData = data.map((d) => ({
            neighbourhood: d.group,
            permits: d.count,
          }));
          return React.createElement(NeighbourhoodBarChart, {
            data: chartData,
            dataKey: "permits",
            color: "#f59e0b",
            tooltipLabel: "Vacant Lots",
            height: 350,
          });
        },
      };

    case "permits":
      return {
        title: `${config.name} — Permits`,
        source: config.dataSource,
        render: async () => {
          const data = await fetchPermitsByGroup(config);
          const chartData = data.slice(0, 15).map((d) => ({
            neighbourhood: d.group,
            permits: d.count,
          }));
          return React.createElement(NeighbourhoodBarChart, {
            data: chartData,
            dataKey: "permits",
            color: "#3b82f6",
            tooltipLabel: "Permits",
            height: 350,
          });
        },
      };

    default:
      return null;
  }
}

// Helper to merge two time series by month for dual-axis charts
function mergeTwoSeries(
  seriesA: TimeSeriesPoint[],
  seriesB: TimeSeriesPoint[],
  keyA: string,
  keyB: string
): MultiSeriesPoint[] {
  const dateMap = new Map<string, MultiSeriesPoint>();
  for (const p of seriesA) {
    const month = p.date.slice(0, 7);
    if (!dateMap.has(month)) dateMap.set(month, { date: p.date, [keyA]: 0, [keyB]: 0 });
    dateMap.get(month)![keyA] = p.value;
  }
  for (const p of seriesB) {
    const month = p.date.slice(0, 7);
    if (!dateMap.has(month)) dateMap.set(month, { date: p.date, [keyA]: 0, [keyB]: 0 });
    dateMap.get(month)![keyB] = p.value;
  }
  return Array.from(dateMap.values())
    .filter((p) => p[keyA] && p[keyB])
    .sort((a, b) => String(a.date).localeCompare(String(b.date)));
}

// Macro charts (province-wide)
function macroChart(type: string): ChartDef | null {
  switch (type) {
    case "policy-rate":
      return {
        title: "BoC Policy Rate",
        source: "Bank of Canada Valet API",
        render: async () => {
          const data = await fetchBoCTimeSeries(BOC_SERIES.POLICY_RATE);
          return React.createElement(TimeSeriesAreaChart, { data, color: "#3b82f6", height: 350, valueSuffix: "%" });
        },
      };

    case "cad-usd":
      return {
        title: "CAD/USD Exchange Rate",
        source: "Bank of Canada Valet API",
        render: async () => {
          const data = await fetchBoCTimeSeries(BOC_SERIES.CAD_USD, 240);
          return React.createElement(TimeSeriesAreaChart, { data, color: "#10b981", height: 350, valuePrefix: "$" });
        },
      };

    case "unemployment":
      return {
        title: "Alberta Unemployment Rate",
        source: "Statistics Canada 14-10-0287",
        render: async () => {
          const s = STATSCAN_SERIES.AB_UNEMPLOYMENT_RATE;
          const data = await fetchStatCanTimeSeries(s.tableId, s.coordinate, 60);
          return React.createElement(TimeSeriesAreaChart, { data, color: "#ef4444", height: 350, valueSuffix: "%" });
        },
      };

    case "cpi":
      return {
        title: "Alberta CPI (All Items)",
        source: "Statistics Canada 18-10-0004",
        render: async () => {
          const s = STATSCAN_SERIES.AB_CPI;
          const data = await fetchStatCanTimeSeries(s.tableId, s.coordinate, 60);
          return React.createElement(TimeSeriesAreaChart, { data, color: "#a855f7", height: 350 });
        },
      };

    case "population":
      return {
        title: "Alberta Population",
        source: "Statistics Canada 17-10-0005",
        render: async () => {
          const s = STATSCAN_SERIES.AB_POPULATION;
          const data = await fetchStatCanTimeSeries(s.tableId, s.coordinate, 40);
          return React.createElement(TimeSeriesAreaChart, { data, color: "#3b82f6", height: 350, compact: true });
        },
      };

    case "energy-price":
      return {
        title: "BoC Energy Commodity Price Index",
        source: "Bank of Canada Valet API",
        render: async () => {
          const data = await fetchBoCTimeSeries(BOC_SERIES.BCPI_ENERGY, 240);
          return React.createElement(TimeSeriesAreaChart, { data, color: "#f97316", height: 350 });
        },
      };

    case "all-commodities":
      return {
        title: "BoC All Commodities Index",
        source: "Bank of Canada Valet API",
        render: async () => {
          const data = await fetchBoCTimeSeries(BOC_SERIES.BCPI_ALL, 240);
          return React.createElement(TimeSeriesAreaChart, { data, color: "#3b82f6", height: 350 });
        },
      };

    case "non-energy":
      return {
        title: "Non-Energy Commodity Index",
        source: "Bank of Canada Valet API",
        render: async () => {
          const data = await fetchBoCTimeSeries(BOC_SERIES.BCPI_NON_ENERGY, 120);
          return React.createElement(TimeSeriesAreaChart, { data, color: "#10b981", height: 350 });
        },
      };

    case "energy-vs-cad":
      return {
        title: "Energy Price vs CAD/USD",
        source: "Bank of Canada Valet API",
        render: async () => {
          const [energy, cad] = await Promise.all([
            fetchBoCTimeSeries(BOC_SERIES.BCPI_ENERGY, 120),
            fetchBoCTimeSeries(BOC_SERIES.CAD_USD, 120),
          ]);
          const merged = mergeTwoSeries(energy, cad, "energy", "cad");
          return React.createElement(MultiSeriesLineChart, {
            data: merged,
            series: [
              { key: "energy", label: "Energy Index", color: "#f97316", yAxisId: "left" },
              { key: "cad", label: "CAD/USD", color: "#10b981", prefix: "$", yAxisId: "right" },
            ],
            height: 350,
            dualAxis: true,
          });
        },
      };

    case "oil-gas-gdp":
      return {
        title: "Alberta Mining/Oil & Gas GDP",
        source: "Statistics Canada 36-10-0402",
        render: async () => {
          const { tableId, coordinate } = STATSCAN_SERIES.AB_GDP_MINING_OIL_GAS;
          const data = await fetchStatCanTimeSeries(tableId, coordinate, 40);
          return React.createElement(TimeSeriesAreaChart, { data, color: "#f59e0b", height: 350, compact: true });
        },
      };

    case "construction-gdp":
      return {
        title: "Alberta Construction GDP",
        source: "Statistics Canada 36-10-0402",
        render: async () => {
          const { tableId, coordinate } = STATSCAN_SERIES.AB_GDP_CONSTRUCTION;
          const data = await fetchStatCanTimeSeries(tableId, coordinate, 40);
          return React.createElement(TimeSeriesAreaChart, { data, color: "#06b6d4", height: 350, compact: true });
        },
      };

    case "employment":
      return {
        title: "Alberta Employment",
        source: "Statistics Canada 14-10-0287",
        render: async () => {
          const { tableId, coordinate } = STATSCAN_SERIES.AB_EMPLOYMENT;
          const data = await fetchStatCanTimeSeries(tableId, coordinate, 60);
          return React.createElement(TimeSeriesAreaChart, { data, color: "#3b82f6", height: 350, compact: true });
        },
      };

    case "participation":
      return {
        title: "Participation Rate",
        source: "Statistics Canada 14-10-0287",
        render: async () => {
          const { tableId, coordinate } = STATSCAN_SERIES.AB_PARTICIPATION_RATE;
          const data = await fetchStatCanTimeSeries(tableId, coordinate, 60);
          return React.createElement(TimeSeriesAreaChart, { data, color: "#10b981", height: 350, valueSuffix: "%" });
        },
      };

    case "employment-rate":
      return {
        title: "Employment Rate",
        source: "Statistics Canada 14-10-0287",
        render: async () => {
          const { tableId, coordinate } = STATSCAN_SERIES.AB_EMPLOYMENT_RATE;
          const data = await fetchStatCanTimeSeries(tableId, coordinate, 60);
          return React.createElement(TimeSeriesAreaChart, { data, color: "#8b5cf6", height: 350, valueSuffix: "%" });
        },
      };

    case "weekly-earnings":
      return {
        title: "Average Weekly Earnings",
        source: "Statistics Canada 14-10-0223",
        render: async () => {
          const { tableId, coordinate } = STATSCAN_SERIES.AB_WEEKLY_EARNINGS;
          const data = await fetchStatCanTimeSeries(tableId, coordinate, 60);
          return React.createElement(TimeSeriesAreaChart, { data, color: "#f59e0b", height: 350, valuePrefix: "$" });
        },
      };

    case "employment-vs-unemployment":
      return {
        title: "Employment vs Unemployment Rate",
        source: "Statistics Canada 14-10-0287",
        render: async () => {
          const [employment, unemployment] = await Promise.all([
            fetchStatCanTimeSeries(STATSCAN_SERIES.AB_EMPLOYMENT.tableId, STATSCAN_SERIES.AB_EMPLOYMENT.coordinate, 60),
            fetchStatCanTimeSeries(STATSCAN_SERIES.AB_UNEMPLOYMENT_RATE.tableId, STATSCAN_SERIES.AB_UNEMPLOYMENT_RATE.coordinate, 60),
          ]);
          const merged = mergeTwoSeries(employment, unemployment, "employment", "unemployment");
          return React.createElement(MultiSeriesLineChart, {
            data: merged,
            series: [
              { key: "employment", label: "Employment (K)", color: "#3b82f6", yAxisId: "left" },
              { key: "unemployment", label: "Unemployment %", color: "#ef4444", suffix: "%", yAxisId: "right" },
            ],
            height: 350,
            dualAxis: true,
          });
        },
      };

    case "immigration":
      return {
        title: "International Immigration to Alberta",
        source: "Statistics Canada 17-10-0008",
        render: async () => {
          const { tableId, coordinate } = STATSCAN_SERIES.AB_IMMIGRATION;
          const data = await fetchStatCanTimeSeries(tableId, coordinate, 40);
          return React.createElement(TimeSeriesBarChart, { data, color: "#10b981", height: 350 });
        },
      };

    case "interprovincial":
      return {
        title: "Net Interprovincial Migration",
        source: "Statistics Canada 17-10-0008",
        render: async () => {
          const { tableId, coordinate } = STATSCAN_SERIES.AB_NET_INTERPROVINCIAL;
          const data = await fetchStatCanTimeSeries(tableId, coordinate, 40);
          return React.createElement(TimeSeriesBarChart, { data, color: "#f97316", height: 350 });
        },
      };

    case "migration-components": {
      return {
        title: "Population Growth Components",
        source: "Statistics Canada 17-10-0008",
        render: async () => {
          const [immigration, netInterprov, emigration, births, deaths] = await Promise.all([
            fetchStatCanTimeSeries(STATSCAN_SERIES.AB_IMMIGRATION.tableId, STATSCAN_SERIES.AB_IMMIGRATION.coordinate, 20),
            fetchStatCanTimeSeries(STATSCAN_SERIES.AB_NET_INTERPROVINCIAL.tableId, STATSCAN_SERIES.AB_NET_INTERPROVINCIAL.coordinate, 20),
            fetchStatCanTimeSeries(STATSCAN_SERIES.AB_EMIGRATION.tableId, STATSCAN_SERIES.AB_EMIGRATION.coordinate, 20),
            fetchStatCanTimeSeries(STATSCAN_SERIES.AB_BIRTHS.tableId, STATSCAN_SERIES.AB_BIRTHS.coordinate, 20),
            fetchStatCanTimeSeries(STATSCAN_SERIES.AB_DEATHS.tableId, STATSCAN_SERIES.AB_DEATHS.coordinate, 20),
          ]);
          const dateMap = new Map<string, MultiSeriesPoint>();
          const addSeries = (data: TimeSeriesPoint[], key: string) => {
            for (const p of data) {
              if (!dateMap.has(p.date)) dateMap.set(p.date, { date: p.date });
              dateMap.get(p.date)![key] = p.value;
            }
          };
          addSeries(immigration, "immigration");
          addSeries(netInterprov, "netInterprov");
          addSeries(emigration, "emigration");
          addSeries(births, "births");
          addSeries(deaths, "deaths");
          const merged = Array.from(dateMap.values()).sort((a, b) => String(a.date).localeCompare(String(b.date)));
          return React.createElement(MultiSeriesLineChart, {
            data: merged,
            series: [
              { key: "immigration", label: "International Immigration", color: "#10b981" },
              { key: "netInterprov", label: "Net Interprovincial", color: "#3b82f6" },
              { key: "emigration", label: "Net Emigration", color: "#ef4444" },
              { key: "births", label: "Births", color: "#f59e0b" },
              { key: "deaths", label: "Deaths", color: "#6b7280" },
            ],
            height: 350,
          });
        },
      };
    }

    case "migration-vs-energy":
      return {
        title: "Net Migration vs Energy Prices",
        source: "Statistics Canada / Bank of Canada",
        render: async () => {
          const [interprovincial, energy] = await Promise.all([
            fetchStatCanTimeSeries(STATSCAN_SERIES.AB_NET_INTERPROVINCIAL.tableId, STATSCAN_SERIES.AB_NET_INTERPROVINCIAL.coordinate, 40),
            fetchBoCTimeSeries(BOC_SERIES.BCPI_ENERGY, 120),
          ]);
          const dateMap = new Map<string, MultiSeriesPoint>();
          for (const p of interprovincial) {
            dateMap.set(p.date, { date: p.date, migration: p.value, energy: 0 });
          }
          for (const p of energy) {
            const quarter = p.date.slice(0, 7);
            for (const [key, point] of dateMap) {
              if (key.startsWith(quarter.slice(0, 4))) {
                if (!point.energy || (point.energy as number) === 0) {
                  point.energy = p.value;
                }
              }
            }
          }
          const merged = Array.from(dateMap.values())
            .filter((p) => p.energy)
            .sort((a, b) => String(a.date).localeCompare(String(b.date)));
          return React.createElement(MultiSeriesLineChart, {
            data: merged,
            series: [
              { key: "migration", label: "Net Interprovincial", color: "#3b82f6", yAxisId: "left" },
              { key: "energy", label: "Energy Index", color: "#f97316", yAxisId: "right" },
            ],
            height: 350,
            dualAxis: true,
          });
        },
      };

    case "ag-commodity":
      return {
        title: "BoC Agriculture Commodity Price Index",
        source: "Bank of Canada Valet API",
        render: async () => {
          const data = await fetchBoCTimeSeries(BOC_SERIES.BCPI_AGRICULTURE, 240);
          return React.createElement(TimeSeriesAreaChart, { data, color: "#f59e0b", height: 350 });
        },
      };

    case "ag-gdp":
      return {
        title: "Agriculture GDP — Alberta",
        source: "Statistics Canada 36-10-0402",
        render: async () => {
          const { tableId, coordinate } = STATSCAN_SERIES.AB_GDP_AGRICULTURE;
          const data = await fetchStatCanTimeSeries(tableId, coordinate, 40);
          return React.createElement(TimeSeriesAreaChart, { data, color: "#10b981", height: 350, compact: true });
        },
      };

    case "farm-receipts":
      return {
        title: "Farm Cash Receipts — Alberta",
        source: "Statistics Canada 32-10-0045",
        render: async () => {
          const { tableId, coordinate } = STATSCAN_SERIES.AB_FARM_CASH_RECEIPTS;
          const data = await fetchStatCanTimeSeries(tableId, coordinate, 40);
          return React.createElement(TimeSeriesBarChart, { data, color: "#f59e0b", height: 350, compact: true });
        },
      };

    case "crop-vs-livestock":
      return {
        title: "Crop vs Livestock Receipts",
        source: "Statistics Canada 32-10-0045",
        render: async () => {
          const [crop, livestock] = await Promise.all([
            fetchStatCanTimeSeries(STATSCAN_SERIES.AB_FARM_CROP_RECEIPTS.tableId, STATSCAN_SERIES.AB_FARM_CROP_RECEIPTS.coordinate, 40),
            fetchStatCanTimeSeries(STATSCAN_SERIES.AB_FARM_LIVESTOCK_RECEIPTS.tableId, STATSCAN_SERIES.AB_FARM_LIVESTOCK_RECEIPTS.coordinate, 40),
          ]);
          const merged = mergeTwoSeries(crop, livestock, "crop", "livestock");
          return React.createElement(MultiSeriesLineChart, {
            data: merged,
            series: [
              { key: "crop", label: "Crop Receipts", color: "#f59e0b" },
              { key: "livestock", label: "Livestock Receipts", color: "#ef4444" },
            ],
            height: 350,
          });
        },
      };

    case "ag-vs-energy":
      return {
        title: "Agriculture vs Energy Commodity Prices",
        source: "Bank of Canada Valet API",
        render: async () => {
          const [agIndex, energyIndex] = await Promise.all([
            fetchBoCTimeSeries(BOC_SERIES.BCPI_AGRICULTURE, 120),
            fetchBoCTimeSeries(BOC_SERIES.BCPI_ENERGY, 120),
          ]);
          const merged = mergeTwoSeries(agIndex, energyIndex, "agriculture", "energy");
          return React.createElement(MultiSeriesLineChart, {
            data: merged,
            series: [
              { key: "agriculture", label: "Agriculture", color: "#f59e0b", yAxisId: "left" },
              { key: "energy", label: "Energy", color: "#f97316", yAxisId: "right" },
            ],
            height: 350,
            dualAxis: true,
          });
        },
      };

    case "gdp-by-industry": {
      return {
        title: "GDP by Industry — Alberta",
        source: "Statistics Canada 36-10-0402",
        render: async () => {
          const [oilGas, construction, agriculture, manufacturing, tech, realEstate] = await Promise.all([
            fetchStatCanTimeSeries(STATSCAN_SERIES.AB_GDP_MINING_OIL_GAS.tableId, STATSCAN_SERIES.AB_GDP_MINING_OIL_GAS.coordinate, 40),
            fetchStatCanTimeSeries(STATSCAN_SERIES.AB_GDP_CONSTRUCTION.tableId, STATSCAN_SERIES.AB_GDP_CONSTRUCTION.coordinate, 40),
            fetchStatCanTimeSeries(STATSCAN_SERIES.AB_GDP_AGRICULTURE.tableId, STATSCAN_SERIES.AB_GDP_AGRICULTURE.coordinate, 40),
            fetchStatCanTimeSeries(STATSCAN_SERIES.AB_GDP_MANUFACTURING.tableId, STATSCAN_SERIES.AB_GDP_MANUFACTURING.coordinate, 40),
            fetchStatCanTimeSeries(STATSCAN_SERIES.AB_GDP_TECH.tableId, STATSCAN_SERIES.AB_GDP_TECH.coordinate, 40),
            fetchStatCanTimeSeries(STATSCAN_SERIES.AB_GDP_REAL_ESTATE.tableId, STATSCAN_SERIES.AB_GDP_REAL_ESTATE.coordinate, 40),
          ]);
          const dateMap = new Map<string, MultiSeriesPoint>();
          const addSeries = (data: TimeSeriesPoint[], key: string) => {
            for (const p of data) {
              if (!dateMap.has(p.date)) dateMap.set(p.date, { date: p.date });
              dateMap.get(p.date)![key] = p.value;
            }
          };
          addSeries(oilGas, "oilGas");
          addSeries(construction, "construction");
          addSeries(agriculture, "agriculture");
          addSeries(manufacturing, "manufacturing");
          addSeries(tech, "tech");
          addSeries(realEstate, "realEstate");
          const merged = Array.from(dateMap.values()).sort((a, b) => String(a.date).localeCompare(String(b.date)));
          return React.createElement(MultiSeriesLineChart, {
            data: merged,
            series: [
              { key: "oilGas", label: "Mining/Oil/Gas", color: "#f97316" },
              { key: "construction", label: "Construction", color: "#3b82f6" },
              { key: "manufacturing", label: "Manufacturing", color: "#8b5cf6" },
              { key: "tech", label: "Tech/Professional", color: "#10b981" },
              { key: "realEstate", label: "Real Estate", color: "#ec4899" },
              { key: "agriculture", label: "Agriculture", color: "#f59e0b" },
            ],
            height: 350,
          });
        },
      };
    }

    case "oil-gas-share":
      return {
        title: "Oil & Gas Share of GDP",
        source: "Statistics Canada 36-10-0402",
        render: async () => {
          const [totalGdp, oilGasGdp] = await Promise.all([
            fetchStatCanTimeSeries(STATSCAN_SERIES.AB_GDP.tableId, STATSCAN_SERIES.AB_GDP.coordinate, 40),
            fetchStatCanTimeSeries(STATSCAN_SERIES.AB_GDP_MINING_OIL_GAS.tableId, STATSCAN_SERIES.AB_GDP_MINING_OIL_GAS.coordinate, 40),
          ]);
          const dateValues = new Map<string, number>();
          for (const p of totalGdp) dateValues.set(p.date, p.value);
          const shareData: TimeSeriesPoint[] = [];
          for (const p of oilGasGdp) {
            const total = dateValues.get(p.date);
            if (total && total > 0) {
              shareData.push({ date: p.date, value: parseFloat(((p.value / total) * 100).toFixed(1)) });
            }
          }
          return React.createElement(TimeSeriesAreaChart, { data: shareData, color: "#f97316", height: 350, valueSuffix: "%" });
        },
      };

    case "tech-gdp":
      return {
        title: "Tech & Professional Services GDP",
        source: "Statistics Canada 36-10-0402",
        render: async () => {
          const { tableId, coordinate } = STATSCAN_SERIES.AB_GDP_TECH;
          const data = await fetchStatCanTimeSeries(tableId, coordinate, 40);
          return React.createElement(TimeSeriesAreaChart, { data, color: "#10b981", height: 350, compact: true });
        },
      };

    case "business-licences":
      return {
        title: "Edmonton Business Licences",
        source: "Edmonton Open Data",
        render: async () => {
          const data = await fetchEdmontonBusinessLicencesTimeSeries();
          return React.createElement(TimeSeriesAreaChart, { data, color: "#8b5cf6", height: 350 });
        },
      };

    case "building-permits":
      return {
        title: "Edmonton Building Permits",
        source: "Edmonton Open Data",
        render: async () => {
          const data = await fetchEdmontonPermitsSummary();
          return React.createElement(TimeSeriesAreaChart, { data, color: "#f59e0b", height: 350 });
        },
      };

    case "energy-vs-unemployment":
      return {
        title: "Energy Price vs Unemployment",
        source: "Bank of Canada / Statistics Canada",
        render: async () => {
          const [energy, unemployment] = await Promise.all([
            fetchBoCTimeSeries(BOC_SERIES.BCPI_ENERGY, 120),
            fetchStatCanTimeSeries(STATSCAN_SERIES.AB_UNEMPLOYMENT_RATE.tableId, STATSCAN_SERIES.AB_UNEMPLOYMENT_RATE.coordinate, 60),
          ]);
          const merged = mergeTwoSeries(energy, unemployment, "energy", "unemployment");
          return React.createElement(MultiSeriesLineChart, {
            data: merged,
            series: [
              { key: "energy", label: "Energy Index", color: "#f97316", yAxisId: "left" },
              { key: "unemployment", label: "Unemployment %", color: "#ef4444", suffix: "%", yAxisId: "right" },
            ],
            height: 350,
            dualAxis: true,
          });
        },
      };

    case "energy-vs-housing":
      return {
        title: "Energy Price vs Housing Starts",
        source: "Bank of Canada / CMHC",
        render: async () => {
          const [energy, housing] = await Promise.all([
            fetchBoCTimeSeries(BOC_SERIES.BCPI_ENERGY, 120),
            fetchStatCanTimeSeries(STATSCAN_SERIES.EDMONTON_HOUSING_STARTS.tableId, STATSCAN_SERIES.EDMONTON_HOUSING_STARTS.coordinate, 60),
          ]);
          const merged = mergeTwoSeries(energy, housing, "energy", "housing");
          return React.createElement(MultiSeriesLineChart, {
            data: merged,
            series: [
              { key: "energy", label: "Energy Index", color: "#f97316", yAxisId: "left" },
              { key: "housing", label: "Housing Starts", color: "#3b82f6", yAxisId: "right" },
            ],
            height: 350,
            dualAxis: true,
          });
        },
      };

    case "gdp":
      return {
        title: "Alberta Real GDP",
        source: "Statistics Canada 36-10-0402",
        render: async () => {
          const { tableId, coordinate } = STATSCAN_SERIES.AB_GDP;
          const data = await fetchStatCanTimeSeries(tableId, coordinate, 40);
          return React.createElement(TimeSeriesAreaChart, { data, color: "#10b981", height: 350, compact: true });
        },
      };

    case "aax":
      return {
        title: "Alberta Activity Index (AAX)",
        source: "Alberta Open Data",
        render: async () => {
          const allData = await fetchAlbertaActivityIndex();
          const data = allData.slice(-240);
          return React.createElement(TimeSeriesAreaChart, { data, color: "#8b5cf6", height: 350 });
        },
      };

    default:
      return null;
  }
}

// ============================================================
// Alias mappings — chart IDs that resolve to the same data as macro charts
// ============================================================

const ALIAS_TO_MACRO: Record<string, string> = {
  // Drilling view
  "drilling-energy-index": "macro-energy-price",
  "drilling-oil-gas-gdp": "macro-oil-gas-gdp",
  "drilling-energy-vs-cad": "macro-energy-vs-cad",
  "drilling-construction-gdp": "macro-construction-gdp",
  // Investment view
  "invest-policy-rate": "macro-policy-rate",
  "invest-energy-index": "macro-energy-price",
  "invest-energy-vs-cad": "macro-energy-vs-cad",
  "invest-employment": "macro-employment",
  "invest-migration": "macro-interprovincial",
  // Risk view
  "risk-unemployment": "macro-unemployment",
  "risk-energy-vs-unemployment": "macro-energy-vs-unemployment",
};

// ============================================================
// Economy charts — retail, cannabis, business dynamics
// ============================================================

function economyChart(type: string): ChartDef | null {
  switch (type) {
    case "retail-total-sales":
      return {
        title: "Alberta Total Retail Sales",
        source: "Statistics Canada 20-10-0056",
        render: async () => {
          const s = STATSCAN_SERIES.AB_RETAIL_SALES;
          const data = await fetchStatCanTimeSeries(s.tableId, s.coordinate, 60);
          return React.createElement(TimeSeriesAreaChart, { data, color: "#3b82f6", height: 350, compact: true, valuePrefix: "$" });
        },
      };

    case "retail-subsectors":
      return {
        title: "Retail Sales by Subsector",
        source: "Statistics Canada 20-10-0056",
        render: async () => {
          const data = await fetchRetailSubsectors(60);
          const merged: MultiSeriesPoint[] = data.map((d) => ({
            date: d.date,
            motorVehicle: d.motorVehicle,
            foodBeverage: d.foodBeverage,
            gasoline: d.gasoline,
            generalMerch: d.generalMerch,
            clothing: d.clothing,
            buildingMaterials: d.buildingMaterials,
          }));
          return React.createElement(MultiSeriesLineChart, {
            data: merged,
            series: [
              { key: "motorVehicle", label: "Motor Vehicle", color: "#3b82f6" },
              { key: "foodBeverage", label: "Food & Beverage", color: "#10b981" },
              { key: "gasoline", label: "Gasoline", color: "#f97316" },
              { key: "generalMerch", label: "General Merch", color: "#8b5cf6" },
              { key: "clothing", label: "Clothing", color: "#ec4899" },
              { key: "buildingMaterials", label: "Building Materials", color: "#f59e0b" },
            ],
            height: 350,
          });
        },
      };

    case "retail-ecommerce-share":
      return {
        title: "E-Commerce Share of Retail",
        source: "Statistics Canada 20-10-0056",
        render: async () => {
          const [ecomm, total] = await Promise.all([
            fetchEcommerceSales(60),
            fetchStatCanTimeSeries(STATSCAN_SERIES.AB_RETAIL_SALES.tableId, STATSCAN_SERIES.AB_RETAIL_SALES.coordinate, 60),
          ]);
          const totalMap = new Map(total.map((p) => [p.date, p.value]));
          const shareData: TimeSeriesPoint[] = ecomm
            .map((p) => {
              const t = totalMap.get(p.date);
              return t && t > 0 ? { date: p.date, value: parseFloat(((p.value / t) * 100).toFixed(1)) } : null;
            })
            .filter((p): p is TimeSeriesPoint => p !== null);
          return React.createElement(TimeSeriesAreaChart, { data: shareData, color: "#8b5cf6", height: 350, valueSuffix: "%" });
        },
      };

    case "retail-ecommerce-sales":
      return {
        title: "E-Commerce Sales Volume",
        source: "Statistics Canada 20-10-0056",
        render: async () => {
          const data = await fetchEcommerceSales(60);
          return React.createElement(TimeSeriesAreaChart, { data, color: "#8b5cf6", height: 350, compact: true, valuePrefix: "$" });
        },
      };

    case "retail-food-services":
      return {
        title: "Food Services Revenue Breakdown",
        source: "Statistics Canada 21-10-0019",
        render: async () => {
          const data = await fetchFoodServices(60);
          const merged: MultiSeriesPoint[] = data.map((d) => ({
            date: d.date,
            fullService: d.fullService,
            limitedService: d.limitedService,
            drinking: d.drinking,
          }));
          return React.createElement(MultiSeriesLineChart, {
            data: merged,
            series: [
              { key: "fullService", label: "Full-Service", color: "#3b82f6" },
              { key: "limitedService", label: "Fast Food", color: "#f97316" },
              { key: "drinking", label: "Drinking Places", color: "#ef4444" },
            ],
            height: 350,
          });
        },
      };

    case "retail-food-services-total":
      return {
        title: "Food Services Total Revenue",
        source: "Statistics Canada 21-10-0019",
        render: async () => {
          const s = STATSCAN_SERIES.AB_FOOD_SERVICES_TOTAL;
          const data = await fetchStatCanTimeSeries(s.tableId, s.coordinate, 60);
          return React.createElement(TimeSeriesAreaChart, { data, color: "#10b981", height: 350, compact: true, valuePrefix: "$" });
        },
      };

    case "cannabis-monthly-sales":
      return {
        title: "Alberta Cannabis Monthly Sales",
        source: "Statistics Canada 20-10-0056",
        render: async () => {
          const s = STATSCAN_SERIES.AB_CANNABIS_RETAIL_SALES;
          const data = await fetchStatCanTimeSeries(s.tableId, s.coordinate, 60);
          return React.createElement(TimeSeriesAreaChart, { data, color: "#10b981", height: 350, compact: true, valuePrefix: "$" });
        },
      };

    case "cannabis-sales-trend":
      return {
        title: "Cannabis Sales Trend",
        source: "Statistics Canada 20-10-0056",
        render: async () => {
          const s = STATSCAN_SERIES.AB_CANNABIS_RETAIL_SALES;
          const data = await fetchStatCanTimeSeries(s.tableId, s.coordinate, 120);
          return React.createElement(TimeSeriesAreaChart, { data, color: "#10b981", height: 350, compact: true, valuePrefix: "$" });
        },
      };

    case "cannabis-retail-share":
      return {
        title: "Cannabis Share of Retail",
        source: "Statistics Canada 20-10-0056",
        render: async () => {
          const [cannabis, total] = await Promise.all([
            fetchStatCanTimeSeries(STATSCAN_SERIES.AB_CANNABIS_RETAIL_SALES.tableId, STATSCAN_SERIES.AB_CANNABIS_RETAIL_SALES.coordinate, 60),
            fetchStatCanTimeSeries(STATSCAN_SERIES.AB_RETAIL_SALES.tableId, STATSCAN_SERIES.AB_RETAIL_SALES.coordinate, 60),
          ]);
          const totalMap = new Map(total.map((p) => [p.date, p.value]));
          const shareData: TimeSeriesPoint[] = cannabis
            .map((p) => {
              const t = totalMap.get(p.date);
              return t && t > 0 ? { date: p.date, value: parseFloat(((p.value / t) * 100).toFixed(2)) } : null;
            })
            .filter((p): p is TimeSeriesPoint => p !== null);
          return React.createElement(TimeSeriesAreaChart, { data: shareData, color: "#10b981", height: 350, valueSuffix: "%" });
        },
      };

    case "cannabis-product-type":
      return {
        title: "Cannabis Sales by Product Type",
        source: "Health Canada",
        render: async () => {
          const data = await fetchCannabisProductQuarterly();
          const merged: MultiSeriesPoint[] = data.map((d) => ({
            date: d.date,
            driedFlower: d.driedFlower,
            edibles: d.edibles,
            extracts: d.extracts,
            topicals: d.topicals,
          }));
          return React.createElement(MultiSeriesLineChart, {
            data: merged,
            series: [
              { key: "driedFlower", label: "Dried Flower", color: "#10b981" },
              { key: "extracts", label: "Extracts", color: "#8b5cf6" },
              { key: "edibles", label: "Edibles", color: "#f59e0b" },
              { key: "topicals", label: "Topicals", color: "#ec4899" },
            ],
            height: 350,
          });
        },
      };

    case "biz-all-dynamics":
      return {
        title: "Business Openings & Closures — All Industries",
        source: "Statistics Canada 33-10-0270",
        render: async () => {
          const data = await fetchBusinessDynamics(60);
          const merged: MultiSeriesPoint[] = data.map((d) => ({
            date: d.date,
            openings: d.openings,
            closures: d.closures,
          }));
          return React.createElement(MultiSeriesLineChart, {
            data: merged,
            series: [
              { key: "openings", label: "Openings", color: "#10b981" },
              { key: "closures", label: "Closures", color: "#ef4444" },
            ],
            height: 350,
          });
        },
      };

    case "biz-active-count":
      return {
        title: "Active Business Count",
        source: "Statistics Canada 33-10-0270",
        render: async () => {
          const data = await fetchBusinessDynamics(60);
          const ts: TimeSeriesPoint[] = data.map((d) => ({ date: d.date, value: d.active }));
          return React.createElement(TimeSeriesAreaChart, { data: ts, color: "#3b82f6", height: 350, compact: true });
        },
      };

    case "biz-retail-dynamics":
      return {
        title: "Retail Trade Business Dynamics",
        source: "Statistics Canada 33-10-0270",
        render: async () => {
          const data = await fetchRetailBusinessDynamics(60);
          const merged: MultiSeriesPoint[] = data.map((d) => ({
            date: d.date,
            openings: d.openings,
            closures: d.closures,
          }));
          return React.createElement(MultiSeriesLineChart, {
            data: merged,
            series: [
              { key: "openings", label: "Openings", color: "#10b981" },
              { key: "closures", label: "Closures", color: "#ef4444" },
            ],
            height: 350,
          });
        },
      };

    case "biz-food-dynamics":
      return {
        title: "Food Services Business Dynamics",
        source: "Statistics Canada 33-10-0270",
        render: async () => {
          const data = await fetchFoodBusinessDynamics(60);
          const merged: MultiSeriesPoint[] = data.map((d) => ({
            date: d.date,
            openings: d.openings,
            closures: d.closures,
          }));
          return React.createElement(MultiSeriesLineChart, {
            data: merged,
            series: [
              { key: "openings", label: "Openings", color: "#10b981" },
              { key: "closures", label: "Closures", color: "#ef4444" },
            ],
            height: 350,
          });
        },
      };

    case "biz-edmonton-licence-trend":
      return {
        title: "Edmonton Business Licence Trend",
        source: "Edmonton Open Data",
        render: async () => {
          const data = await fetchEdmontonLicenceMonthlyTrend();
          const ts: TimeSeriesPoint[] = data.map((d) => ({ date: `${d.date}-01`, value: d.value }));
          return React.createElement(TimeSeriesAreaChart, { data: ts, color: "#8b5cf6", height: 350 });
        },
      };

    default:
      return null;
  }
}

// ============================================================
// Benchmark charts — cross-municipality comparisons
// ============================================================

function benchChart(type: string): ChartDef | null {
  const municipalities = getLiveMunicipalities().slice(0, 10);
  switch (type) {
    case "avg-assessment":
      return {
        title: "Average Assessment by Municipality",
        source: "Municipal Open Data",
        render: async () => {
          const results = await Promise.all(
            municipalities.map(async (m) => {
              const data = await fetchAssessmentsByGroup(m, "zoning").catch(() => []);
              const total = data.reduce((s, d) => s + d.avgAssessment * d.count, 0);
              const count = data.reduce((s, d) => s + d.count, 0);
              return { neighbourhood: m.name, avgValue: count > 0 ? Math.round(total / count) : 0 };
            })
          );
          const chartData = results.filter((d) => d.avgValue > 0).sort((a, b) => b.avgValue - a.avgValue);
          return React.createElement(NeighbourhoodBarChart, {
            data: chartData,
            dataKey: "avgValue",
            color: "#3b82f6",
            valuePrefix: "$",
            tooltipLabel: "Avg Assessment",
            height: 350,
          });
        },
      };

    case "parcel-count":
      return {
        title: "Total Parcels by Municipality",
        source: "Municipal Open Data",
        render: async () => {
          const results = await Promise.all(
            municipalities.map(async (m) => {
              const data = await fetchAssessmentsByGroup(m, "zoning").catch(() => []);
              const count = data.reduce((s, d) => s + d.count, 0);
              return { neighbourhood: m.name, permits: count };
            })
          );
          const chartData = results.filter((d) => d.permits > 0).sort((a, b) => b.permits - a.permits);
          return React.createElement(NeighbourhoodBarChart, {
            data: chartData,
            dataKey: "permits",
            color: "#10b981",
            tooltipLabel: "Parcels",
            height: 350,
          });
        },
      };

    case "vacant-lots":
      return {
        title: "Vacant Lots by Municipality",
        source: "Municipal Open Data",
        render: async () => {
          const results = await Promise.all(
            municipalities.map(async (m) => {
              const data = await fetchVacantLots(m).catch(() => []);
              const count = data.reduce((s, d) => s + d.count, 0);
              return { neighbourhood: m.name, permits: count };
            })
          );
          const chartData = results.filter((d) => d.permits > 0).sort((a, b) => b.permits - a.permits);
          return React.createElement(NeighbourhoodBarChart, {
            data: chartData,
            dataKey: "permits",
            color: "#f59e0b",
            tooltipLabel: "Vacant Lots",
            height: 350,
          });
        },
      };

    case "businesses":
      return {
        title: "Active Businesses by Municipality",
        source: "Municipal Open Data",
        render: async () => {
          const results = await Promise.all(
            municipalities.map(async (m) => {
              const data = await fetchBusinessCategories(m).catch(() => []);
              const count = data.reduce((s, d) => s + d.count, 0);
              return { neighbourhood: m.name, permits: count };
            })
          );
          const chartData = results.filter((d) => d.permits > 0).sort((a, b) => b.permits - a.permits);
          return React.createElement(NeighbourhoodBarChart, {
            data: chartData,
            dataKey: "permits",
            color: "#a855f7",
            tooltipLabel: "Businesses",
            height: 350,
          });
        },
      };

    default:
      return null;
  }
}

// ============================================================
// Real estate charts
// ============================================================

function realEstateChart(type: string): ChartDef | null {
  switch (type) {
    // Metro dwelling/permit data (StatCan)
    case "metro-dwelling-units":
      return {
        title: "Edmonton CMA — Dwelling Units Created",
        source: "Statistics Canada 34-10-0292",
        render: async () => {
          const s = STATSCAN_SERIES.EDMONTON_CMA_RES_UNITS;
          const data = await fetchStatCanTimeSeries(s.tableId, s.coordinate, 60);
          return React.createElement(TimeSeriesBarChart, { data, color: "#3b82f6", height: 350 });
        },
      };

    case "metro-permit-value":
      return {
        title: "Edmonton CMA — Residential Permit Value",
        source: "Statistics Canada 34-10-0292",
        render: async () => {
          const s = STATSCAN_SERIES.EDMONTON_CMA_RES_PERMIT_VALUE;
          const data = await fetchStatCanTimeSeries(s.tableId, s.coordinate, 60);
          return React.createElement(TimeSeriesAreaChart, { data, color: "#10b981", height: 350, compact: true, valuePrefix: "$" });
        },
      };

    case "metro-single-family":
      return {
        title: "Edmonton CMA — Single-Family Units",
        source: "Statistics Canada 34-10-0292",
        render: async () => {
          const s = STATSCAN_SERIES.EDMONTON_CMA_SINGLE_UNITS;
          const data = await fetchStatCanTimeSeries(s.tableId, s.coordinate, 60);
          return React.createElement(TimeSeriesBarChart, { data, color: "#f59e0b", height: 350 });
        },
      };

    // Edmonton-specific (Open Data)
    case "edmonton-road-construction-types":
      return {
        title: "Edmonton — Construction Permits by Type",
        source: "Edmonton Open Data",
        render: async () => {
          const data = await fetchRoadConstructionByType();
          const chartData = data.slice(0, 15).map((d) => ({
            neighbourhood: d.type,
            permits: d.count,
          }));
          return React.createElement(NeighbourhoodBarChart, {
            data: chartData,
            dataKey: "permits",
            color: "#3b82f6",
            tooltipLabel: "Projects",
            height: 350,
          });
        },
      };

    case "major-projects-sector":
      return {
        title: "Major Projects Investment by Sector",
        source: "Alberta Open Data",
        render: async () => {
          const projects = await fetchAlbertaMajorProjects();
          const sectorMap = new Map<string, number>();
          for (const p of projects) {
            const sector = p.sector || "Other";
            sectorMap.set(sector, (sectorMap.get(sector) || 0) + 1);
          }
          const chartData = Array.from(sectorMap.entries())
            .map(([sector, count]) => ({ neighbourhood: sector, permits: count }))
            .sort((a, b) => b.permits - a.permits)
            .slice(0, 15);
          return React.createElement(NeighbourhoodBarChart, {
            data: chartData,
            dataKey: "permits",
            color: "#f97316",
            tooltipLabel: "Projects",
            height: 350,
          });
        },
      };

    case "edmonton-new-units":
      return {
        title: "Edmonton — New Housing Units Permitted",
        source: "Edmonton Open Data",
        render: async () => {
          const data = await fetchResidentialPermitTrend();
          return React.createElement(TimeSeriesBarChart, { data, color: "#3b82f6", height: 350 });
        },
      };

    case "edmonton-hot-zones":
      return {
        title: "Edmonton — Where New Homes Are Being Built",
        source: "Edmonton Open Data",
        render: async () => {
          const data = await fetchHotNeighbourhoods();
          const chartData = data.map((d) => ({
            neighbourhood: d.neighbourhood,
            permits: d.units,
          }));
          return React.createElement(NeighbourhoodBarChart, {
            data: chartData,
            dataKey: "permits",
            color: "#10b981",
            tooltipLabel: "Units",
            height: 350,
          });
        },
      };

    case "edmonton-construction-value":
      return {
        title: "Edmonton — Construction $ by Neighbourhood",
        source: "Edmonton Open Data",
        render: async () => {
          const data = await fetchHotNeighbourhoods();
          const chartData = data.map((d) => ({
            neighbourhood: d.neighbourhood,
            avgValue: d.avgValue,
          }));
          return React.createElement(NeighbourhoodBarChart, {
            data: chartData,
            dataKey: "avgValue",
            color: "#f59e0b",
            valuePrefix: "$",
            tooltipLabel: "Avg Value",
            height: 350,
          });
        },
      };

    case "edmonton-high-assessments":
      return {
        title: "Edmonton — Highest Assessed Neighbourhoods",
        source: "Edmonton Open Data",
        render: async () => {
          const data = await fetchTopNeighbourhoodAssessments();
          const chartData = data.map((d) => ({
            neighbourhood: d.neighbourhood,
            avgValue: d.avgValue,
          }));
          return React.createElement(NeighbourhoodBarChart, {
            data: chartData,
            dataKey: "avgValue",
            color: "#3b82f6",
            valuePrefix: "$",
            tooltipLabel: "Avg Assessment",
            height: 350,
          });
        },
      };

    case "edmonton-redeveloping":
      return {
        title: "Edmonton — Redeveloping Neighbourhoods",
        source: "Edmonton Open Data",
        render: async () => {
          const data = await fetchRedevelopingActivity();
          const chartData = data.map((d) => ({
            neighbourhood: d.neighbourhood,
            permits: d.permits,
          }));
          return React.createElement(NeighbourhoodBarChart, {
            data: chartData,
            dataKey: "permits",
            color: "#8b5cf6",
            tooltipLabel: "Dev Permits",
            height: 350,
          });
        },
      };

    case "edmonton-renovation":
      return {
        title: "Edmonton — Home Improvement Hotspots",
        source: "Edmonton Open Data",
        render: async () => {
          const data = await fetchHomeImprovementHotspots();
          const chartData = data.map((d) => ({
            neighbourhood: d.neighbourhood,
            permits: d.permits,
          }));
          return React.createElement(NeighbourhoodBarChart, {
            data: chartData,
            dataKey: "permits",
            color: "#f97316",
            tooltipLabel: "Renovation Permits",
            height: 350,
          });
        },
      };

    case "strathcona-subdivisions":
      return {
        title: "Strathcona County — Hot Subdivisions",
        source: "Strathcona County Open Data",
        render: async () => {
          const data = await fetchStrathconaHotSubdivisions();
          const chartData = data.map((d) => ({
            neighbourhood: d.subdivision,
            permits: d.permits,
          }));
          return React.createElement(NeighbourhoodBarChart, {
            data: chartData,
            dataKey: "permits",
            color: "#3b82f6",
            tooltipLabel: "Permits",
            height: 350,
          });
        },
      };

    case "strathcona-assessments":
      return {
        title: "Strathcona County — Assessments by Type",
        source: "Strathcona County Open Data",
        render: async () => {
          const data = await fetchStrathconaAssessmentsByArea();
          const chartData = data.map((d) => ({
            neighbourhood: d.neighbourhood,
            avgValue: d.avgValue,
          }));
          return React.createElement(NeighbourhoodBarChart, {
            data: chartData,
            dataKey: "avgValue",
            color: "#10b981",
            valuePrefix: "$",
            tooltipLabel: "Avg Assessment",
            height: 350,
          });
        },
      };

    case "stalbert-assessments":
      return {
        title: "St. Albert — Assessments by Neighbourhood",
        source: "St. Albert Open Data",
        render: async () => {
          const data = await fetchStAlbertAssessmentsByNeighbourhood();
          const chartData = data.map((d) => ({
            neighbourhood: d.neighbourhood,
            avgValue: d.avgValue,
          }));
          return React.createElement(NeighbourhoodBarChart, {
            data: chartData,
            dataKey: "avgValue",
            color: "#8b5cf6",
            valuePrefix: "$",
            tooltipLabel: "Avg Assessment",
            height: 350,
          });
        },
      };

    // CMHC comparison charts
    case "cmhc-housing-starts":
      return {
        title: "Housing Starts — Edmonton vs Calgary",
        source: "Statistics Canada 34-10-0154",
        render: async () => {
          const data = await fetchHousingStarts(60);
          const merged: MultiSeriesPoint[] = data.map((d) => ({
            date: d.date,
            edmonton: d.edmonton,
            calgary: d.calgary,
          }));
          return React.createElement(MultiSeriesLineChart, {
            data: merged,
            series: [
              { key: "edmonton", label: "Edmonton", color: "#3b82f6" },
              { key: "calgary", label: "Calgary", color: "#ef4444" },
            ],
            height: 350,
          });
        },
      };

    case "cmhc-completions":
      return {
        title: "Housing Completions — Edmonton vs Calgary",
        source: "Statistics Canada 34-10-0154",
        render: async () => {
          const data = await fetchHousingCompletions(60);
          const merged: MultiSeriesPoint[] = data.map((d) => ({
            date: d.date,
            edmonton: d.edmonton,
            calgary: d.calgary,
          }));
          return React.createElement(MultiSeriesLineChart, {
            data: merged,
            series: [
              { key: "edmonton", label: "Edmonton", color: "#3b82f6" },
              { key: "calgary", label: "Calgary", color: "#ef4444" },
            ],
            height: 350,
          });
        },
      };

    case "cmhc-under-construction":
      return {
        title: "Under Construction — Edmonton vs Calgary",
        source: "Statistics Canada 34-10-0154",
        render: async () => {
          const data = await fetchUnderConstruction(60);
          const merged: MultiSeriesPoint[] = data.map((d) => ({
            date: d.date,
            edmonton: d.edmonton,
            calgary: d.calgary,
          }));
          return React.createElement(MultiSeriesLineChart, {
            data: merged,
            series: [
              { key: "edmonton", label: "Edmonton", color: "#3b82f6" },
              { key: "calgary", label: "Calgary", color: "#ef4444" },
            ],
            height: 350,
          });
        },
      };

    case "cmhc-mortgage-rate":
      return {
        title: "5-Year Conventional Mortgage Rate",
        source: "Statistics Canada 34-10-0145",
        render: async () => {
          const data = await fetchMortgageRate(60);
          return React.createElement(TimeSeriesAreaChart, { data, color: "#ef4444", height: 350, valueSuffix: "%" });
        },
      };

    // Pipeline (Edmonton CMA housing pipeline)
    case "housing-starts":
      return {
        title: "Housing Starts — Edmonton CMA",
        source: "Statistics Canada 34-10-0154",
        render: async () => {
          const s = STATSCAN_SERIES.EDMONTON_HOUSING_STARTS;
          const data = await fetchStatCanTimeSeries(s.tableId, s.coordinate, 60);
          return React.createElement(TimeSeriesBarChart, { data, color: "#3b82f6", height: 350 });
        },
      };

    case "housing-completions":
      return {
        title: "Housing Completions — Edmonton CMA",
        source: "Statistics Canada 34-10-0154",
        render: async () => {
          const s = STATSCAN_SERIES.EDMONTON_HOUSING_COMPLETIONS;
          const data = await fetchStatCanTimeSeries(s.tableId, s.coordinate, 60);
          return React.createElement(TimeSeriesBarChart, { data, color: "#10b981", height: 350 });
        },
      };

    case "under-construction":
      return {
        title: "Units Under Construction — Edmonton CMA",
        source: "Statistics Canada 34-10-0154",
        render: async () => {
          const s = STATSCAN_SERIES.EDMONTON_UNDER_CONSTRUCTION;
          const data = await fetchStatCanTimeSeries(s.tableId, s.coordinate, 60);
          return React.createElement(TimeSeriesAreaChart, { data, color: "#f59e0b", height: 350, compact: true });
        },
      };

    case "pipeline-overlay":
      return {
        title: "Full Pipeline Overlay",
        source: "Statistics Canada 34-10-0154",
        render: async () => {
          const [starts, completions, underConstruction] = await Promise.all([
            fetchStatCanTimeSeries(STATSCAN_SERIES.EDMONTON_HOUSING_STARTS.tableId, STATSCAN_SERIES.EDMONTON_HOUSING_STARTS.coordinate, 60),
            fetchStatCanTimeSeries(STATSCAN_SERIES.EDMONTON_HOUSING_COMPLETIONS.tableId, STATSCAN_SERIES.EDMONTON_HOUSING_COMPLETIONS.coordinate, 60),
            fetchStatCanTimeSeries(STATSCAN_SERIES.EDMONTON_UNDER_CONSTRUCTION.tableId, STATSCAN_SERIES.EDMONTON_UNDER_CONSTRUCTION.coordinate, 60),
          ]);
          const dateMap = new Map<string, MultiSeriesPoint>();
          const addSeries = (data: TimeSeriesPoint[], key: string) => {
            for (const p of data) {
              if (!dateMap.has(p.date)) dateMap.set(p.date, { date: p.date });
              dateMap.get(p.date)![key] = p.value;
            }
          };
          addSeries(starts, "starts");
          addSeries(completions, "completions");
          addSeries(underConstruction, "underConstruction");
          const merged = Array.from(dateMap.values()).sort((a, b) => String(a.date).localeCompare(String(b.date)));
          return React.createElement(MultiSeriesLineChart, {
            data: merged,
            series: [
              { key: "starts", label: "Starts", color: "#3b82f6" },
              { key: "completions", label: "Completions", color: "#10b981" },
              { key: "underConstruction", label: "Under Construction", color: "#f59e0b", yAxisId: "right" },
            ],
            height: 350,
            dualAxis: true,
          });
        },
      };

    case "starts-vs-permits":
      return {
        title: "Housing Starts vs Permit Value",
        source: "Statistics Canada",
        render: async () => {
          const [starts, permits] = await Promise.all([
            fetchStatCanTimeSeries(STATSCAN_SERIES.EDMONTON_HOUSING_STARTS.tableId, STATSCAN_SERIES.EDMONTON_HOUSING_STARTS.coordinate, 60),
            fetchStatCanTimeSeries(STATSCAN_SERIES.EDMONTON_CMA_RES_PERMIT_VALUE.tableId, STATSCAN_SERIES.EDMONTON_CMA_RES_PERMIT_VALUE.coordinate, 60),
          ]);
          const merged = mergeTwoSeries(starts, permits, "starts", "permitValue");
          return React.createElement(MultiSeriesLineChart, {
            data: merged,
            series: [
              { key: "starts", label: "Housing Starts", color: "#3b82f6", yAxisId: "left" },
              { key: "permitValue", label: "Permit Value ($)", color: "#10b981", prefix: "$", yAxisId: "right" },
            ],
            height: 350,
            dualAxis: true,
          });
        },
      };

    // Rental
    case "rental-vacancy-compare":
      return {
        title: "Rental Vacancy Rate — Edmonton vs Calgary",
        source: "Statistics Canada 34-10-0127",
        render: async () => {
          const data = await fetchVacancyRates(20);
          const merged: MultiSeriesPoint[] = data.map((d) => ({
            date: d.date,
            edmonton: d.edmonton,
            calgary: d.calgary,
          }));
          return React.createElement(MultiSeriesLineChart, {
            data: merged,
            series: [
              { key: "edmonton", label: "Edmonton", color: "#3b82f6", suffix: "%" },
              { key: "calgary", label: "Calgary", color: "#ef4444", suffix: "%" },
            ],
            height: 350,
          });
        },
      };

    case "rent-trends-compare":
      return {
        title: "Average Rents — Edmonton vs Calgary",
        source: "Statistics Canada 34-10-0133",
        render: async () => {
          const data = await fetchRentComparison(20);
          const merged: MultiSeriesPoint[] = data.map((d) => ({
            date: d.date,
            edmonton1Bed: d.edmontonOneBed,
            edmonton2Bed: d.edmontonTwoBed,
            calgary1Bed: d.calgaryOneBed,
            calgary2Bed: d.calgaryTwoBed,
          }));
          return React.createElement(MultiSeriesLineChart, {
            data: merged,
            series: [
              { key: "edmonton1Bed", label: "Edmonton 1-Bed", color: "#3b82f6", prefix: "$" },
              { key: "edmonton2Bed", label: "Edmonton 2-Bed", color: "#60a5fa", prefix: "$" },
              { key: "calgary1Bed", label: "Calgary 1-Bed", color: "#ef4444", prefix: "$" },
              { key: "calgary2Bed", label: "Calgary 2-Bed", color: "#f87171", prefix: "$" },
            ],
            height: 350,
          });
        },
      };

    case "rent-edm-breakdown":
      return {
        title: "Edmonton Rents by Unit Type",
        source: "Statistics Canada 34-10-0133",
        render: async () => {
          const data = await fetchRentComparison(20);
          const merged: MultiSeriesPoint[] = data.map((d) => ({
            date: d.date,
            bachelor: d.edmontonBachelor,
            oneBed: d.edmontonOneBed,
            twoBed: d.edmontonTwoBed,
            threeBed: d.edmontonThreeBed,
          }));
          return React.createElement(MultiSeriesLineChart, {
            data: merged,
            series: [
              { key: "bachelor", label: "Bachelor", color: "#6b7280", prefix: "$" },
              { key: "oneBed", label: "1-Bed", color: "#3b82f6", prefix: "$" },
              { key: "twoBed", label: "2-Bed", color: "#10b981", prefix: "$" },
              { key: "threeBed", label: "3-Bed", color: "#f59e0b", prefix: "$" },
            ],
            height: 350,
          });
        },
      };

    case "rent-cal-breakdown":
      return {
        title: "Calgary Rents by Unit Type",
        source: "Statistics Canada 34-10-0133",
        render: async () => {
          const data = await fetchRentComparison(20);
          const merged: MultiSeriesPoint[] = data.map((d) => ({
            date: d.date,
            bachelor: d.calgaryBachelor,
            oneBed: d.calgaryOneBed,
            twoBed: d.calgaryTwoBed,
            threeBed: d.calgaryThreeBed,
          }));
          return React.createElement(MultiSeriesLineChart, {
            data: merged,
            series: [
              { key: "bachelor", label: "Bachelor", color: "#6b7280", prefix: "$" },
              { key: "oneBed", label: "1-Bed", color: "#ef4444", prefix: "$" },
              { key: "twoBed", label: "2-Bed", color: "#f97316", prefix: "$" },
              { key: "threeBed", label: "3-Bed", color: "#f59e0b", prefix: "$" },
            ],
            height: 350,
          });
        },
      };

    case "vacancy-vs-starts":
      return {
        title: "Edmonton Vacancy Rate vs Housing Starts",
        source: "Statistics Canada",
        render: async () => {
          const [vacancy, starts] = await Promise.all([
            fetchStatCanTimeSeries(STATSCAN_SERIES.EDMONTON_VACANCY_RATE.tableId, STATSCAN_SERIES.EDMONTON_VACANCY_RATE.coordinate, 20),
            fetchStatCanTimeSeries(STATSCAN_SERIES.EDMONTON_HOUSING_STARTS.tableId, STATSCAN_SERIES.EDMONTON_HOUSING_STARTS.coordinate, 60),
          ]);
          const merged = mergeTwoSeries(vacancy, starts, "vacancy", "starts");
          return React.createElement(MultiSeriesLineChart, {
            data: merged,
            series: [
              { key: "vacancy", label: "Vacancy %", color: "#ef4444", suffix: "%", yAxisId: "left" },
              { key: "starts", label: "Housing Starts", color: "#3b82f6", yAxisId: "right" },
            ],
            height: 350,
            dualAxis: true,
          });
        },
      };

    // Assessments
    case "assessment-city-trend":
      return {
        title: "City-Wide Assessment Trends",
        source: "Statistics Canada / Municipal Data",
        render: async () => {
          const [edm, cal] = await Promise.all([
            fetchHousingStarts(60),
            fetchHousingCompletions(60),
          ]);
          // Use housing starts/completions as proxy for city assessment trends
          const merged: MultiSeriesPoint[] = edm.map((d) => ({
            date: d.date,
            edmonton: d.edmonton,
            calgary: d.calgary,
          }));
          return React.createElement(MultiSeriesLineChart, {
            data: merged,
            series: [
              { key: "edmonton", label: "Edmonton", color: "#3b82f6" },
              { key: "calgary", label: "Calgary", color: "#ef4444" },
            ],
            height: 350,
          });
        },
      };

    case "assessment-edm-top":
      return {
        title: "Edmonton — Top Assessed Neighbourhoods",
        source: "Edmonton Open Data",
        render: async () => {
          const data = await fetchTopNeighbourhoodAssessments();
          const chartData = data.map((d) => ({
            neighbourhood: d.neighbourhood,
            avgValue: d.avgValue,
          }));
          return React.createElement(NeighbourhoodBarChart, {
            data: chartData,
            dataKey: "avgValue",
            color: "#3b82f6",
            valuePrefix: "$",
            tooltipLabel: "Avg Assessment",
            height: 350,
          });
        },
      };

    case "assessment-cal-top":
      return {
        title: "Calgary — Top Assessed Neighbourhoods",
        source: "Calgary Open Data",
        render: async () => {
          // Use Calgary municipality config if available
          const config = getMunicipality("calgary");
          if (config) {
            const data = await fetchAssessmentsByGroup(config, "neighbourhood").catch(() => []);
            const chartData = data
              .sort((a, b) => b.avgAssessment - a.avgAssessment)
              .slice(0, 15)
              .map((d) => ({ neighbourhood: d.group, avgValue: d.avgAssessment }));
            return React.createElement(NeighbourhoodBarChart, {
              data: chartData,
              dataKey: "avgValue",
              color: "#ef4444",
              valuePrefix: "$",
              tooltipLabel: "Avg Assessment",
              height: 350,
            });
          }
          return React.createElement("div", { className: "text-sm text-muted" }, "Calgary data not yet available");
        },
      };

    // Commercial
    case "commercial-assessments":
      return {
        title: "Top Commercial Neighbourhoods by Assessment",
        source: "Edmonton Open Data",
        render: async () => {
          const data = await fetchEdmontonCommercialAssessments();
          const chartData = data.map((d) => ({
            neighbourhood: d.neighbourhood,
            avgValue: d.avgValue,
          }));
          return React.createElement(NeighbourhoodBarChart, {
            data: chartData,
            dataKey: "avgValue",
            color: "#f97316",
            valuePrefix: "$",
            tooltipLabel: "Avg Commercial Assessment",
            height: 350,
          });
        },
      };

    case "business-categories":
      return {
        title: "Business Licences by Category",
        source: "Edmonton Open Data",
        render: async () => {
          const data = await fetchEdmontonBusinessCategories();
          const chartData = data.map((d) => ({
            neighbourhood: d.category,
            permits: d.count,
          }));
          return React.createElement(NeighbourhoodBarChart, {
            data: chartData,
            dataKey: "permits",
            color: "#8b5cf6",
            tooltipLabel: "Licences",
            height: 350,
          });
        },
      };

    case "business-density":
      return {
        title: "Business Density by Neighbourhood",
        source: "Edmonton Open Data",
        render: async () => {
          const data = await fetchEdmontonBusinessesByNeighbourhood();
          const chartData = data.map((d) => ({
            neighbourhood: d.neighbourhood,
            permits: d.count,
          }));
          return React.createElement(NeighbourhoodBarChart, {
            data: chartData,
            dataKey: "permits",
            color: "#10b981",
            tooltipLabel: "Businesses",
            height: 350,
          });
        },
      };

    case "commercial-permits":
      return {
        title: "Commercial Building Permits — Edmonton",
        source: "Edmonton Open Data",
        render: async () => {
          const data = await fetchEdmontonCommercialPermits();
          return React.createElement(TimeSeriesAreaChart, { data, color: "#f97316", height: 350 });
        },
      };

    case "business-licences":
      return {
        title: "New Business Licences — Edmonton",
        source: "Edmonton Open Data",
        render: async () => {
          const data = await fetchEdmontonBusinessLicencesTimeSeries();
          return React.createElement(TimeSeriesAreaChart, { data, color: "#8b5cf6", height: 350 });
        },
      };

    case "retail-sales":
      return {
        title: "Alberta Retail Sales",
        source: "Statistics Canada 20-10-0056",
        render: async () => {
          const s = STATSCAN_SERIES.AB_RETAIL_SALES;
          const data = await fetchStatCanTimeSeries(s.tableId, s.coordinate, 60);
          return React.createElement(TimeSeriesAreaChart, { data, color: "#3b82f6", height: 350, compact: true, valuePrefix: "$" });
        },
      };

    default:
      return null;
  }
}

// ============================================================
// Investment charts (non-alias ones)
// ============================================================

function investChart(type: string): ChartDef | null {
  switch (type) {
    case "housing-starts":
      return {
        title: "Edmonton CMA Housing Starts — Investment View",
        source: "Statistics Canada 34-10-0154",
        render: async () => {
          const s = STATSCAN_SERIES.EDMONTON_HOUSING_STARTS;
          const data = await fetchStatCanTimeSeries(s.tableId, s.coordinate, 60);
          return React.createElement(TimeSeriesBarChart, { data, color: "#3b82f6", height: 350 });
        },
      };

    case "permit-value":
      return {
        title: "Edmonton CMA Residential Permit Value",
        source: "Statistics Canada 34-10-0292",
        render: async () => {
          const s = STATSCAN_SERIES.EDMONTON_CMA_RES_PERMIT_VALUE;
          const data = await fetchStatCanTimeSeries(s.tableId, s.coordinate, 60);
          return React.createElement(TimeSeriesAreaChart, { data, color: "#10b981", height: 350, compact: true, valuePrefix: "$" });
        },
      };

    default:
      return null;
  }
}

// ============================================================
// Risk charts (non-alias ones)
// ============================================================

function riskChart(type: string): ChartDef | null {
  switch (type) {
    case "rate-vs-starts":
      return {
        title: "Policy Rate vs Housing Starts",
        source: "Bank of Canada / Statistics Canada",
        render: async () => {
          const [rate, starts] = await Promise.all([
            fetchBoCTimeSeries(BOC_SERIES.POLICY_RATE),
            fetchStatCanTimeSeries(STATSCAN_SERIES.EDMONTON_HOUSING_STARTS.tableId, STATSCAN_SERIES.EDMONTON_HOUSING_STARTS.coordinate, 60),
          ]);
          const merged = mergeTwoSeries(rate, starts, "rate", "starts");
          return React.createElement(MultiSeriesLineChart, {
            data: merged,
            series: [
              { key: "rate", label: "Policy Rate %", color: "#ef4444", suffix: "%", yAxisId: "left" },
              { key: "starts", label: "Housing Starts", color: "#3b82f6", yAxisId: "right" },
            ],
            height: 350,
            dualAxis: true,
          });
        },
      };

    default:
      return null;
  }
}

// ============================================================
// Community charts — safety, fire
// ============================================================

function communityChart(type: string): ChartDef | null {
  switch (type) {
    case "calgary-crime-by-category":
      return {
        title: "Calgary Crime by Category",
        source: "Calgary Open Data",
        render: async () => {
          const data = await fetchCrimeByCategory();
          const chartData = data.slice(0, 15).map((d) => ({
            neighbourhood: d.category,
            permits: d.totalCount,
          }));
          return React.createElement(NeighbourhoodBarChart, {
            data: chartData,
            dataKey: "permits",
            color: "#ef4444",
            tooltipLabel: "Incidents",
            height: 350,
          });
        },
      };

    case "calgary-crime-trend":
      return {
        title: "Calgary Crime Trend",
        source: "Calgary Open Data",
        render: async () => {
          const data = await fetchCalgaryMonthlyTrend();
          const ts: TimeSeriesPoint[] = data.map((d) => ({ date: d.date, value: d.value }));
          return React.createElement(TimeSeriesAreaChart, { data: ts, color: "#ef4444", height: 350 });
        },
      };

    case "incidents-by-type":
      return {
        title: "Edmonton Fire Incidents by Type",
        source: "Edmonton Open Data",
        render: async () => {
          const data = await fetchEdmontonFireByType();
          const chartData = data.slice(0, 15).map((d) => ({
            neighbourhood: d.eventType,
            permits: d.count,
          }));
          return React.createElement(NeighbourhoodBarChart, {
            data: chartData,
            dataKey: "permits",
            color: "#f97316",
            tooltipLabel: "Incidents",
            height: 350,
          });
        },
      };

    case "monthly-trend":
      return {
        title: "Edmonton Fire/EMS Monthly Call Volume",
        source: "Edmonton Open Data",
        render: async () => {
          const data = await fetchEdmontonFireMonthlyTrend();
          const ts: TimeSeriesPoint[] = data.map((d) => ({ date: d.date, value: d.value }));
          return React.createElement(TimeSeriesAreaChart, { data: ts, color: "#f97316", height: 350 });
        },
      };

    default:
      return null;
  }
}

// ============================================================
// Cycle chart — boom/bust timeline
// ============================================================

function cycleChart(type: string): ChartDef | null {
  if (type === "timeline") {
    return {
      title: "Economic Cycle Timeline",
      source: "Statistics Canada / Bank of Canada",
      render: async () => {
        // Use energy index as proxy for Alberta economic cycles
        const data = await fetchBoCTimeSeries(BOC_SERIES.BCPI_ENERGY, 480);
        return React.createElement(TimeSeriesAreaChart, { data, color: "#f97316", height: 350 });
      },
    };
  }
  return null;
}

// ============================================================
// Weather charts
// ============================================================

// Station IDs: Edmonton Blatchford = 3012209, Calgary Intl Airport = 3031093
const CLIMATE_STATIONS = {
  EDMONTON: "3012209",
  CALGARY: "3031093",
} as const;

function weatherChart(type: string): ChartDef | null {
  switch (type) {
    case "edmonton-climate":
      return {
        title: "Edmonton Monthly Mean Temperature",
        source: "Environment Canada (ECCC)",
        render: async () => {
          const data = await fetchClimateMonthly(CLIMATE_STATIONS.EDMONTON, 60);
          return React.createElement(TimeSeriesAreaChart, { data, color: "#06b6d4", height: 350, valueSuffix: "°C" });
        },
      };

    case "calgary-climate":
      return {
        title: "Calgary Monthly Mean Temperature",
        source: "Environment Canada (ECCC)",
        render: async () => {
          const data = await fetchClimateMonthly(CLIMATE_STATIONS.CALGARY, 60);
          return React.createElement(TimeSeriesAreaChart, { data, color: "#06b6d4", height: 350, valueSuffix: "°C" });
        },
      };

    default:
      return null;
  }
}

export function resolveChart(chartId: string): ChartDef | null {
  // Check alias mappings first (drilling-*, invest-*, risk-* that map to macro)
  const aliasTarget = ALIAS_TO_MACRO[chartId];
  if (aliasTarget) {
    return macroChart(aliasTarget.replace("macro-", ""));
  }

  // Macro charts: "macro-policy-rate", "macro-unemployment"
  if (chartId.startsWith("macro-")) {
    return macroChart(chartId.replace("macro-", ""));
  }

  // Economy charts: "economy-retail-*", "economy-cannabis-*", "economy-biz-*"
  if (chartId.startsWith("economy-")) {
    return economyChart(chartId.replace("economy-", ""));
  }

  // Benchmark charts: "bench-*"
  if (chartId.startsWith("bench-")) {
    return benchChart(chartId.replace("bench-", ""));
  }

  // Real estate charts: "re-*"
  if (chartId.startsWith("re-")) {
    return realEstateChart(chartId.replace("re-", ""));
  }

  // Investment charts (non-alias): "invest-*"
  if (chartId.startsWith("invest-")) {
    return investChart(chartId.replace("invest-", ""));
  }

  // Risk charts (non-alias): "risk-*"
  if (chartId.startsWith("risk-")) {
    return riskChart(chartId.replace("risk-", ""));
  }

  // Safety charts: "safety-*"
  if (chartId.startsWith("safety-")) {
    return communityChart(chartId.replace("safety-", ""));
  }

  // Fire charts: "fire-*"
  if (chartId.startsWith("fire-")) {
    return communityChart(chartId.replace("fire-", ""));
  }

  // Cycle charts: "cycle-*"
  if (chartId.startsWith("cycle-")) {
    return cycleChart(chartId.replace("cycle-", ""));
  }

  // Weather charts: "weather-*"
  if (chartId.startsWith("weather-")) {
    return weatherChart(chartId.replace("weather-", ""));
  }

  // Municipality charts: "{slug}-{type}"
  // Find the longest matching slug
  const allSlugs = getLiveMunicipalities().map((m) => m.slug).sort((a, b) => b.length - a.length);
  for (const slug of allSlugs) {
    if (chartId.startsWith(`${slug}-`)) {
      const type = chartId.slice(slug.length + 1);
      return municipalityChart(slug, type);
    }
  }

  return null;
}
