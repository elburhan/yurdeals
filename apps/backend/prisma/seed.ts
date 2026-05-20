import bcrypt from 'bcryptjs';
import {
  CampaignStatus,
  PrismaClient,
  ProductApprovalStatus,
  ProductStockType,
  UserRole,
} from '@prisma/client';

const prisma = new PrismaClient();
const BCRYPT_COST = 12;

async function main() {
  process.stdout.write('Seeding YurDeals database...\n');

  const electronics = await prisma.category.upsert({
    where: { slug: 'electronics' },
    update: {},
    create: {
      name: 'Electronics',
      slug: 'electronics',
      description: 'Phones, gadgets, accessories, and smart devices.',
      sortOrder: 1,
      isActive: true,
    },
  });

  const fashion = await prisma.category.upsert({
    where: { slug: 'fashion' },
    update: {},
    create: {
      name: 'Fashion',
      slug: 'fashion',
      description: 'Clothing, shoes, bags, and fashion accessories.',
      sortOrder: 2,
      isActive: true,
    },
  });

  const power = await prisma.category.upsert({
    where: { slug: 'power-solar' },
    update: {},
    create: {
      name: 'Power & Solar',
      slug: 'power-solar',
      description: 'Solar gadgets, rechargeable lights, and power solutions.',
      sortOrder: 3,
      isActive: true,
    },
  });

  await prisma.category.upsert({
    where: { slug: 'cars-trucks' },
    update: {},
    create: {
      name: 'Cars and Trucks',
      slug: 'cars-trucks',
      description: 'Vehicles, pickups, trucks, and related automotive listings.',
      sortOrder: 4,
      isActive: true,
    },
  });

  await prisma.category.upsert({
    where: { slug: 'bulk-deals' },
    update: {},
    create: {
      name: 'Bulk deals',
      slug: 'bulk-deals',
      description: 'Discounted multi-quantity and wholesale-friendly offers.',
      sortOrder: 5,
      isActive: true,
    },
  });

  const products = [
    {
      name: 'Smart Fitness Watch',
      slug: 'smart-fitness-watch',
      description: 'Affordable smart watch with heart rate tracking, steps, and notifications.',
      shortDesc: 'Fitness tracking watch for daily use.',
      categoryId: electronics.id,
      basePrice: '18500.00',
      stockType: ProductStockType.IN_STOCK,
      sku: 'YD-SFW-001',
      isFeatured: true,
      tags: ['watch', 'fitness', 'electronics'],
      image: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30',
    },
    {
      name: 'Portable Bluetooth Speaker',
      slug: 'portable-bluetooth-speaker',
      description: 'Compact wireless speaker with strong battery life and clear sound.',
      shortDesc: 'Portable speaker for music and calls.',
      categoryId: electronics.id,
      basePrice: '12500.00',
      stockType: ProductStockType.IN_STOCK,
      sku: 'YD-PBS-001',
      isFeatured: true,
      tags: ['speaker', 'bluetooth', 'audio'],
      image: 'https://images.unsplash.com/photo-1608043152269-423dbba4e7e1',
    },
    {
      name: 'Men Casual Sneakers',
      slug: 'men-casual-sneakers',
      description: 'Comfortable everyday sneakers suitable for casual outings.',
      shortDesc: 'Comfortable casual sneakers.',
      categoryId: fashion.id,
      basePrice: '22000.00',
      stockType: ProductStockType.IN_STOCK,
      sku: 'YD-MCS-001',
      isFeatured: true,
      tags: ['shoes', 'fashion', 'sneakers'],
      image: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff',
    },
    {
      name: 'Mini Solar Rechargeable Lamp',
      slug: 'mini-solar-rechargeable-lamp',
      description: 'Rechargeable solar lamp for home, outdoor, and emergency use.',
      shortDesc: 'Solar lamp with rechargeable battery.',
      categoryId: power.id,
      basePrice: '9500.00',
      stockType: ProductStockType.PREORDER,
      sku: 'YD-MSL-001',
      isFeatured: true,
      tags: ['solar', 'lamp', 'power'],
      image: 'https://images.unsplash.com/photo-1509391366360-2e959784a276',
    },
  ];

  for (const item of products) {
    const product = await prisma.product.upsert({
      where: { slug: item.slug },
      update: {
        approvalStatus: ProductApprovalStatus.APPROVED,
        isPublished: true,
      },
      create: {
        name: item.name,
        slug: item.slug,
        description: item.description,
        shortDesc: item.shortDesc,
        categoryId: item.categoryId,
        basePrice: item.basePrice,
        stockType: item.stockType,
        sku: item.sku,
        isFeatured: item.isFeatured,
        isActive: true,
        approvalStatus: ProductApprovalStatus.APPROVED,
        isPublished: true,
        tags: item.tags,
      },
    });

    await prisma.productImage.upsert({
      where: {
        productId_sortOrder: {
          productId: product.id,
          sortOrder: 0,
        },
      },
      update: {
        url: item.image,
        alt: item.name,
        isPrimary: true,
      },
      create: {
        id: `${product.id}-primary-image`,
        productId: product.id,
        url: item.image,
        alt: item.name,
        sortOrder: 0,
        isPrimary: true,
      },
    });

    await prisma.productVariant.upsert({
      where: { sku: `${item.sku}-DEFAULT` },
      update: {},
      create: {
        productId: product.id,
        name: 'Default',
        sku: `${item.sku}-DEFAULT`,
        price: item.basePrice,
        stock: item.stockType === ProductStockType.IN_STOCK ? 20 : 0,
        attributes: {},
        isActive: true,
      },
    });

    if (item.stockType === ProductStockType.PREORDER) {
      await prisma.preorderCampaign.upsert({
        where: { id: `${product.id}-campaign` },
        update: {},
        create: {
          id: `${product.id}-campaign`,
          productId: product.id,
          title: `${item.name} Preorder`,
          description: 'Join this preorder campaign to reserve your unit.',
          targetQty: 50,
          currentQty: 0,
          pricePerUnit: item.basePrice,
          status: CampaignStatus.ACTIVE,
          startsAt: new Date(),
          endsAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
        },
      });
    }
  }

  await seedAdminUser();

  process.stdout.write('Seed completed successfully.\n');
}

function getOptionalSeedEnv(key: string): string | undefined {
  const value = process.env[key]?.trim();
  return value ? value : undefined;
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

async function seedAdminUser(): Promise<void> {
  const adminEmail = getOptionalSeedEnv('SEED_ADMIN_EMAIL');
  const adminPassword = getOptionalSeedEnv('SEED_ADMIN_PASSWORD');

  if (!adminEmail || !adminPassword) {
    process.stdout.write(
      'Skipping admin seed. Set SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD before running db:seed to create or update an admin user.\n',
    );
    return;
  }

  if (adminPassword.length < 12) {
    throw new Error('SEED_ADMIN_PASSWORD must be at least 12 characters long.');
  }

  const email = normalizeEmail(adminEmail);
  const passwordHash = await bcrypt.hash(adminPassword, BCRYPT_COST);

  await prisma.user.upsert({
    where: { email },
    update: {
      passwordHash,
      role: UserRole.ADMIN,
      firstName: 'YurDeals',
      lastName: 'Admin',
      isVerified: true,
      emailVerified: true,
      isActive: true,
    },
    create: {
      email,
      passwordHash,
      firstName: 'YurDeals',
      lastName: 'Admin',
      role: UserRole.ADMIN,
      isVerified: true,
      emailVerified: true,
      isActive: true,
    },
    select: { id: true },
  });

  process.stdout.write(`Admin seed ensured for ${email}.\n`);
}

main()
  .catch((error) => {
    process.stderr.write(`Seed failed: ${error instanceof Error ? error.message : String(error)}\n`);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
