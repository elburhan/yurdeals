export interface ReviewTestimonial {
  id: string;
  name: string;
  location: string;
  text: string;
  rating: number;
}

export const reviews: ReviewTestimonial[] = [
  {
    id: 'review-ada-lagos',
    name: 'Ada M.',
    location: 'Lagos',
    text: 'The tracking updates made the preorder feel less risky. I knew when my items moved from China to Nigeria.',
    rating: 5,
  },
  {
    id: 'review-tunde-abuja',
    name: 'Tunde A.',
    location: 'Abuja',
    text: 'I used YurDeals to test phone accessories for my shop. The product snapshots and checkout flow were clear.',
    rating: 5,
  },
  {
    id: 'review-ifeoma-ph',
    name: 'Ifeoma N.',
    location: 'Port Harcourt',
    text: 'Support helped me understand which products were local and which were preorder. That clarity helped a lot.',
    rating: 4,
  },
];
