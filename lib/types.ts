export type ParsedReceiptItem = {
  name: string;
  quantity: number;
  totalPriceCents: number;
};

export type ParsedReceipt = {
  restaurantName?: string | null;
  currency: string;
  items: ParsedReceiptItem[];
  taxCents: number;
  tipCents: number;
};

export type AssignableUnit = {
  id: string;
  label: string;
  amountCents: number;
  sourceItemName: string;
  sourceRowIndex: number;
  unitIndex: number;
};

export type PersonTotal = {
  name: string;
  subtotalCents: number;
  taxShareCents: number;
  tipShareCents: number;
  totalCents: number;
};

export type NamedCents = {
  name: string;
  amountCents: number;
};

export type UnitAllocationBreakdown = {
  unitId: string;
  label: string;
  amountCents: number;
  assignedPeople: string[];
  perPersonShares: NamedCents[];
};

export type SplitBreakdown = {
  personTotals: PersonTotal[];
  unitAllocations: UnitAllocationBreakdown[];
  subtotalShares: NamedCents[];
  taxShares: NamedCents[];
  tipShares: NamedCents[];
};
