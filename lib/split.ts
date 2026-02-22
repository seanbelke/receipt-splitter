import type {
  AssignableUnit,
  ParsedReceipt,
  PersonTotal,
  SplitBreakdown
} from "./types.ts";

export function moneyFromCents(cents: number): string {
  return (cents / 100).toFixed(2);
}

export function expandItemsToUnits(receipt: ParsedReceipt): AssignableUnit[] {
  const units: AssignableUnit[] = [];

  receipt.items.forEach((item, rowIndex) => {
    const quantity = Number.isFinite(item.quantity) && item.quantity > 0 ? Math.floor(item.quantity) : 1;
    const baseAmount = Math.floor(item.totalPriceCents / quantity);
    const remainder = item.totalPriceCents - baseAmount * quantity;

    for (let i = 0; i < quantity; i += 1) {
      const amountCents = baseAmount + (i < remainder ? 1 : 0);
      units.push({
        id: `${rowIndex}-${i}`,
        label: quantity > 1 ? `${item.name} (${i + 1}/${quantity})` : item.name,
        amountCents,
        sourceItemName: item.name,
        sourceRowIndex: rowIndex,
        unitIndex: i
      });
    }
  });

  return units;
}

function splitCentsEvenly(totalCents: number, names: string[]): Map<string, number> {
  const sortedNames = [...names].sort((a, b) => a.localeCompare(b));
  const base = Math.floor(totalCents / sortedNames.length);
  const remainder = totalCents - base * sortedNames.length;
  const result = new Map<string, number>();

  sortedNames.forEach((name, i) => {
    result.set(name, base + (i < remainder ? 1 : 0));
  });

  return result;
}

function apportionByWeight(totalCents: number, weights: Map<string, number>): Map<string, number> {
  const entries = [...weights.entries()].sort(([a], [b]) => a.localeCompare(b));
  const totalWeight = entries.reduce((sum, [, weight]) => sum + weight, 0);

  const result = new Map<string, number>();
  if (totalCents <= 0 || entries.length === 0) {
    entries.forEach(([name]) => result.set(name, 0));
    return result;
  }

  if (totalWeight <= 0) {
    const equal = splitCentsEvenly(totalCents, entries.map(([name]) => name));
    entries.forEach(([name]) => result.set(name, equal.get(name) ?? 0));
    return result;
  }

  const shares = entries.map(([name, weight]) => {
    const exact = (totalCents * weight) / totalWeight;
    const floorShare = Math.floor(exact);
    return {
      name,
      floorShare,
      remainderWeight: exact - floorShare
    };
  });

  const assigned = shares.reduce((sum, share) => sum + share.floorShare, 0);
  const leftovers = totalCents - assigned;

  shares
    .sort((a, b) => {
      if (b.remainderWeight === a.remainderWeight) {
        return a.name.localeCompare(b.name);
      }
      return b.remainderWeight - a.remainderWeight;
    })
    .forEach((share, i) => {
      const bonus = i < leftovers ? 1 : 0;
      result.set(share.name, share.floorShare + bonus);
    });

  return result;
}

export function calculateTotals(params: {
  people: string[];
  units: AssignableUnit[];
  assignments: Record<string, string[]>;
  taxCents: number;
  tipCents: number;
}): PersonTotal[] {
  return calculateSplitBreakdown(params).personTotals;
}

export function calculateSplitBreakdown(params: {
  people: string[];
  units: AssignableUnit[];
  assignments: Record<string, string[]>;
  taxCents: number;
  tipCents: number;
}): SplitBreakdown {
  const { people, units, assignments, taxCents, tipCents } = params;
  const subtotals = new Map<string, number>(people.map((name) => [name, 0]));
  const sortedPeople = people.slice().sort((a, b) => a.localeCompare(b));
  const unitAllocations: SplitBreakdown["unitAllocations"] = [];

  units.forEach((unit) => {
    const assignedPeople = assignments[unit.id] ?? [];
    const validPeople = assignedPeople.filter((name, i) => people.includes(name) && assignedPeople.indexOf(name) === i);
    if (validPeople.length === 0) {
      unitAllocations.push({
        unitId: unit.id,
        label: unit.label,
        amountCents: unit.amountCents,
        assignedPeople: [],
        perPersonShares: []
      });
      return;
    }

    const split = splitCentsEvenly(unit.amountCents, validPeople);
    const perPersonShares = [...split.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([name, amountCents]) => ({ name, amountCents }));

    split.forEach((value, name) => {
      subtotals.set(name, (subtotals.get(name) ?? 0) + value);
    });

    unitAllocations.push({
      unitId: unit.id,
      label: unit.label,
      amountCents: unit.amountCents,
      assignedPeople: perPersonShares.map((share) => share.name),
      perPersonShares
    });
  });

  const taxShares = apportionByWeight(taxCents, subtotals);
  const tipShares = apportionByWeight(tipCents, subtotals);

  const personTotals = sortedPeople.map((name) => {
    const subtotalCents = subtotals.get(name) ?? 0;
    const taxShareCents = taxShares.get(name) ?? 0;
    const tipShareCents = tipShares.get(name) ?? 0;
    return {
      name,
      subtotalCents,
      taxShareCents,
      tipShareCents,
      totalCents: subtotalCents + taxShareCents + tipShareCents
    };
  });

  return {
    personTotals,
    unitAllocations,
    subtotalShares: sortedPeople.map((name) => ({
      name,
      amountCents: subtotals.get(name) ?? 0
    })),
    taxShares: sortedPeople.map((name) => ({
      name,
      amountCents: taxShares.get(name) ?? 0
    })),
    tipShares: sortedPeople.map((name) => ({
      name,
      amountCents: tipShares.get(name) ?? 0
    }))
  };
}
