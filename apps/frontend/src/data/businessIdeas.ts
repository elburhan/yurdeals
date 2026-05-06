export interface BusinessIdea {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  publishedAt: string;
  content: string[];
}

export const businessIdeas: BusinessIdea[] = [
  {
    id: 'idea-phone-accessories',
    slug: 'phone-accessories-nigeria',
    title: 'Start small with fast-moving phone accessories',
    excerpt:
      'Chargers, earbuds, screen guards, and cases are lightweight, repeat-purchase products that are easy to test.',
    publishedAt: '2026-04-22',
    content: [
      'Phone accessories are a practical first import category because the items are light, familiar, and easy to bundle.',
      'Start with a focused niche such as Type-C chargers, iPhone cases, or screen protectors for popular models. Keep your first order small and track which variants sell fastest.',
      'Use preorder demand to reduce risk: collect interest, confirm colors or models, then restock the strongest performers.',
    ],
  },
  {
    id: 'idea-beauty-tools',
    slug: 'beauty-tools-resale',
    title: 'Build a beauty tools resale bundle',
    excerpt:
      'Hair tools, nail kits, and skincare accessories can be sold as curated bundles for salons and home users.',
    publishedAt: '2026-04-18',
    content: [
      'Beauty tools work well when you package them around a specific customer: salons, students, or home beauty creators.',
      'Bundle complementary products together so buyers can understand the use case quickly. A simple starter kit can be easier to sell than ten unrelated items.',
      'Prioritize clear product photos, voltage compatibility, and replacement accessories so customers trust the purchase.',
    ],
  },
  {
    id: 'idea-home-storage',
    slug: 'home-storage-products',
    title: 'Sell home storage products for small apartments',
    excerpt:
      'Storage racks, organizers, and compact kitchen helpers are useful products with strong everyday appeal.',
    publishedAt: '2026-04-10',
    content: [
      'Home organization products are easy to explain because customers immediately understand the problem they solve.',
      'Choose compact products that photograph well and can survive shipping. Before scaling, test demand with one room category such as kitchen, wardrobe, or bathroom.',
      'Short videos showing before-and-after usage can help these products sell faster on WhatsApp and Instagram.',
    ],
  },
];

export function getBusinessIdeaBySlug(slug: string): BusinessIdea | undefined {
  return businessIdeas.find((idea) => idea.slug === slug);
}
