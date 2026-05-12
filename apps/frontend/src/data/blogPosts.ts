export interface BlogSection {
  heading: string;
  body: string[];
}

export interface BlogPost {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  coverImage: string;
  readTime: string;
  date: string;
  category: string;
  content: BlogSection[];
}

export const blogPosts: BlogPost[] = [
  {
    id: 'preorder-step-by-step',
    title: 'How Preordering from China to Nigeria Works (Step-by-Step)',
    slug: 'how-preordering-from-china-to-nigeria-works-step-by-step',
    excerpt:
      'A clear walkthrough of how YurDeals helps you choose, pay, inspect, track, and receive products from China.',
    coverImage:
      'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&w=1200&q=80',
    readTime: '6 min read',
    date: '2026-04-20',
    category: 'Preorder Guide',
    content: [
      {
        heading: 'Start with vetted products',
        body: [
          'Every preorder starts with a product that has been reviewed for demand, supplier reliability, and delivery fit for Nigerian customers.',
          'You browse the catalog, compare preorder prices, and add the items you want to your cart before checkout.',
        ],
      },
      {
        heading: 'Confirm your delivery details',
        body: [
          'At checkout, you provide your name, phone number, state, city, and area or landmark so our team can coordinate delivery clearly.',
          'You can pay online through our secure payment flow or complete the order with our support team on WhatsApp.',
        ],
      },
      {
        heading: 'We order, inspect, and ship',
        body: [
          'After confirmation, YurDeals coordinates the supplier order in China and checks the product before it leaves the country.',
          'You receive updates as the order moves through inspection, shipping to Nigeria, and last-mile delivery.',
        ],
      },
    ],
  },
  {
    id: 'china-inspection-matters',
    title: "We Inspect Every Product in China - Here's Why It Matters",
    slug: 'we-inspect-every-product-in-china-heres-why-it-matters',
    excerpt:
      'Quality checks reduce surprises, protect your preorder, and help you avoid the common risks of buying blindly from overseas.',
    coverImage:
      'https://images.unsplash.com/photo-1581092160607-ee22621dd758?auto=format&fit=crop&w=1200&q=80',
    readTime: '5 min read',
    date: '2026-04-18',
    category: 'Quality Check',
    content: [
      {
        heading: 'Inspection protects your money',
        body: [
          'Cheap products are only a good deal when the quality is right. Inspection helps catch wrong colors, damaged packaging, and obvious supplier mistakes before shipping.',
          'This gives you a safer preorder experience than sending money to an unknown seller and hoping for the best.',
        ],
      },
      {
        heading: 'What we look for',
        body: [
          'Our checks focus on product condition, model match, quantity, packaging, and whether the item is ready for international handling.',
          'If something looks wrong, support can contact you before the product begins the trip to Nigeria.',
        ],
      },
      {
        heading: 'Why it matters for Nigeria',
        body: [
          'Returns across borders are slow and expensive. A strong inspection step helps reduce stress before shipping begins.',
          'It is one of the main reasons preorder customers can buy with more confidence.',
        ],
      },
    ],
  },
  {
    id: 'delivery-timeline',
    title: 'Real Delivery Timeline: What to Expect (25-40 Days)',
    slug: 'real-delivery-timeline-what-to-expect-25-40-days',
    excerpt:
      'Understand the normal preorder delivery window, what happens at each stage, and when to expect tracking updates.',
    coverImage:
      'https://images.unsplash.com/photo-1566576721346-d4a3b4eaeb55?auto=format&fit=crop&w=1200&q=80',
    readTime: '4 min read',
    date: '2026-04-15',
    category: 'Delivery',
    content: [
      {
        heading: 'Why delivery takes 25-40 days',
        body: [
          'Preorder delivery includes supplier processing, inspection in China, export handling, international shipping, customs movement, and local delivery in Nigeria.',
          'Some orders arrive earlier, but the 25-40 day window is a realistic range for planning.',
        ],
      },
      {
        heading: 'Tracking milestones',
        body: [
          'You should expect updates when your order is confirmed, inspected, shipped toward Nigeria, received locally, and dispatched for final delivery.',
          'These updates help you see progress instead of waiting silently.',
        ],
      },
      {
        heading: 'What can cause delays',
        body: [
          'Supplier restocking, customs processing, weather, and local delivery schedules can affect timing.',
          'When there is a meaningful delay, support can explain what changed and what happens next.',
        ],
      },
    ],
  },
  {
    id: 'customs-duties-nigeria',
    title: 'Common Questions About Customs & Duties in Nigeria',
    slug: 'common-questions-about-customs-and-duties-in-nigeria',
    excerpt:
      'Simple answers to common questions about import handling, duties, and how YurDeals communicates costs clearly.',
    coverImage:
      'https://images.unsplash.com/photo-1494412651409-8963ce7935a7?auto=format&fit=crop&w=1200&q=80',
    readTime: '5 min read',
    date: '2026-04-12',
    category: 'Customs',
    content: [
      {
        heading: 'Are duties included?',
        body: [
          'For many customer-facing products, YurDeals aims to keep checkout costs as clear as possible before you pay.',
          'If an item needs special handling or extra import discussion, support will clarify that before confirmation.',
        ],
      },
      {
        heading: 'Why customs can vary',
        body: [
          'Customs treatment can depend on product type, declared category, shipment route, and current processing conditions.',
          'This is why we avoid vague promises and prefer realistic expectations.',
        ],
      },
      {
        heading: 'How to reduce surprises',
        body: [
          'Choose products with clear descriptions, keep your phone reachable, and ask support before paying if an item is unusually large, heavy, or regulated.',
          'The goal is to make the import process feel understandable, not mysterious.',
        ],
      },
    ],
  },
  {
    id: 'customer-success-stories',
    title: 'Success Stories: Real Deliveries from Our Customers',
    slug: 'success-stories-real-deliveries-from-our-customers',
    excerpt:
      'A look at the kind of preorder experiences Nigerian shoppers can expect when tracking, inspection, and support work together.',
    coverImage:
      'https://images.unsplash.com/photo-1556745757-8d76bdb6984b?auto=format&fit=crop&w=1200&q=80',
    readTime: '4 min read',
    date: '2026-04-08',
    category: 'Customer Stories',
    content: [
      {
        heading: 'A smoother first preorder',
        body: [
          'First-time preorder customers often worry about payment, delivery time, and whether the product will match the listing.',
          'A guided flow, clear WhatsApp support, and inspection updates make the experience easier to trust.',
        ],
      },
      {
        heading: 'Why updates matter',
        body: [
          'Customers feel more confident when they can see that an order has moved from payment to inspection, shipping, and local delivery.',
          'Tracking does not make shipping instant, but it removes a lot of uncertainty.',
        ],
      },
      {
        heading: 'What good support looks like',
        body: [
          'Good support answers practical questions quickly: delivery area, payment confirmation, preorder timing, and what happens if a product has an issue.',
          'That support layer is what turns an overseas preorder into a service Nigerian customers can use comfortably.',
        ],
      },
    ],
  },
];

export function getBlogPostBySlug(slug: string | undefined): BlogPost | undefined {
  return blogPosts.find((post) => post.slug === slug);
}
