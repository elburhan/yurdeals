export type DeliveryStockType = 'IN_STOCK' | 'PREORDER';

export interface DeliveryEstimatePresentation {
  stockType: DeliveryStockType;
  icon: '🚚' | '📦';
  label: string;
  shortLabel: string;
  note: string;
  badgeClassName: string;
  panelClassName: string;
  textClassName: string;
}

// Any preorder item sets the pace for the whole order, so mixed carts use the preorder window.
export function inferDeliveryStockType(
  stockTypes: Array<DeliveryStockType | null | undefined>,
): DeliveryStockType {
  return stockTypes.some((stockType) => stockType === 'PREORDER') ? 'PREORDER' : 'IN_STOCK';
}

export function getDeliveryEstimate(stockType: DeliveryStockType): DeliveryEstimatePresentation {
  if (stockType === 'PREORDER') {
    return {
      stockType,
      icon: '📦',
      label: 'Delivery in 1-3 months',
      shortLabel: '1-3 months',
      note: 'Preorder items are sourced, inspected, and shipped before final delivery in Nigeria.',
      badgeClassName: 'bg-amber-50 text-amber-800 border border-amber-200',
      panelClassName: 'border-amber-200 bg-amber-50',
      textClassName: 'text-amber-800',
    };
  }

  return {
    stockType,
    icon: '🚚',
    label: 'Delivery in 1-3 days',
    shortLabel: '1-3 days',
    note: 'Local stock is ready to move quickly once your order is confirmed.',
    badgeClassName: 'bg-emerald-50 text-emerald-800 border border-emerald-200',
    panelClassName: 'border-emerald-200 bg-emerald-50',
    textClassName: 'text-emerald-800',
  };
}
