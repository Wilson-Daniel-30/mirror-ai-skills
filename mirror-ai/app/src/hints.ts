/**
 * Naming priors for clusters that already exist.
 * These hints never match filenames. Screen titles, endpoints,
 * model fields, routes, and call edges decide membership.
 */
export interface ModuleHint {
  name: string;
  keywords: string[];
}

export const MODULE_HINTS: ModuleHint[] = [
  {
    name: "Just for You",
    keywords: ["just for you", "justforyou", "jfy", "personalizedfeed", "recommendations"],
  },
  {
    name: "Shop",
    keywords: ["shop", "shopping", "productcatalog", "productlisting"],
  },
  {
    name: "Offers",
    keywords: ["offers", "promotions", "discounts", "coupons"],
  },
  {
    name: "Checkout",
    keywords: ["checkout", "payment", "placeorder", "purchase"],
  },
  {
    name: "Account Selection",
    keywords: ["account selection", "accountselection", "selectaccount", "linkedaccounts"],
  },
  {
    name: "Order History",
    keywords: ["order history", "orderhistory", "pastorders"],
  },
];
