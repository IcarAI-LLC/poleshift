// file: taxonomicUtils.ts

import {
  TaxonomicRank,
  ProximityCategory,
} from '@/lib/powersync/DrizzleSchema';

interface TaxDbNode {
  id: number;
  parent_id: number;
  rank: TaxonomicRank;
  tax_name: string;
}

// Ancestor-finding logic...
export function climbUntilRank(
  taxId: number,
  targetRank: TaxonomicRank,
  taxDbMap: Map<number, TaxDbNode>
): number | null {
  const visited = new Set<number>();
  let current = taxId;

  while (true) {
    if (visited.has(current)) {
      // cycle => break
      return null;
    }
    visited.add(current);

    const node = taxDbMap.get(current);
    if (!node) return null;

    if (node.rank === targetRank) {
      return node.id;
    }
    if (!taxDbMap.has(node.parent_id)) {
      return null;
    }
    current = node.parent_id;
  }
}

export function getLineage(
  taxId: number,
  taxDbMap: Map<number, TaxDbNode>
): number[] {
  const lineage: number[] = [];
  const visited = new Set<number>();

  let cur: number | null = taxId;
  while (cur != null && !visited.has(cur)) {
    lineage.push(cur);
    visited.add(cur);

    const node = taxDbMap.get(cur);
    if (!node) break;
    if (!taxDbMap.has(node.parent_id)) break;
    cur = node.parent_id;
  }
  return lineage;
}

export function findLCA(
  a: number,
  b: number,
  taxDbMap: Map<number, TaxDbNode>
): number | null {
  if (a === b) return a;
  const lineageA = getLineage(a, taxDbMap);
  const lineageB = getLineage(b, taxDbMap);

  const setA = new Set(lineageA);
  for (const x of lineageB) {
    if (setA.has(x)) return x;
  }
  return null;
}

export function taxonomicDistance(
  a: number,
  b: number,
  taxDbMap: Map<number, TaxDbNode>
): number {
  if (a === b) return 0;
  const lca = findLCA(a, b, taxDbMap);
  if (!lca) return 999;
  const lineageA = getLineage(a, taxDbMap);
  const lineageB = getLineage(b, taxDbMap);
  const stepsA = lineageA.indexOf(lca);
  const stepsB = lineageB.indexOf(lca);
  return stepsA + stepsB;
}

/**
 * If pc === Close => "Close",
 * otherwise => "Far1", "Far2", etc. exactly as stored in your enum (or DB).
 */
export function getProximityGroup(pc: ProximityCategory | null): string | null {
  if (!pc) return null;
  if (pc === ProximityCategory.Close) return 'Close';
  // Otherwise, if it's "Far1", "Far2", etc., return that exactly
  return pc;
}

// 2) buildChartData
interface LocationInfo {
  id: string;
  label: string;
}

interface BuildOptions {
  groupByKey: string;
}

/**
 * Builds chart-ready data by grouping records on p0.groupByKey.
 */
export function buildChartData(
  records: any[],
  showPercent: boolean,
  _locations: LocationInfo[],
  p0: BuildOptions
): Record<string, any>[] {
  const { groupByKey } = p0;

  // Map<groupValue, Map<taxName, sumReads>>
  const map = new Map<string, Map<string, number>>();

  for (const rec of records) {
    const groupValue = rec[groupByKey] ?? 'N/A';
    const tName = rec.tax_name;
    const reads = rec.reads ?? 0;

    if (!map.has(groupValue)) {
      map.set(groupValue, new Map());
    }
    const taxMap = map.get(groupValue)!;
    if (!taxMap.has(tName)) {
      taxMap.set(tName, 0);
    }
    taxMap.set(tName, taxMap.get(tName)! + reads);
  }

  const rows: Record<string, any>[] = [];
  for (const [groupValue, taxMap] of map.entries()) {
    let totalReads = 0;
    if (showPercent) {
      for (const v of taxMap.values()) {
        totalReads += v;
      }
    }

    const row: Record<string, any> = {
      location: groupValue,
    };
    for (const [tName, sumReads] of taxMap.entries()) {
      if (showPercent && totalReads > 0) {
        row[tName] = sumReads / totalReads;
      } else {
        row[tName] = sumReads;
      }
    }
    rows.push(row);
  }

  return rows;
}
