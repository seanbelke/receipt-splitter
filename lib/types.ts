export type ParsedReceiptItem = {
  name: string;
  quantity: number;
  totalPriceCents: number;
};

export type ParsedReceipt = {
  restaurantName?: string;
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
