import { Prisma, PrismaClient, ProductApprovalStatus } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const includeInactive = process.argv.includes('--include-inactive');

  const targetWhere: Prisma.ProductWhereInput = {
    ...(includeInactive ? {} : { isActive: true }),
    category: {
      isActive: true,
    },
    OR: [
      { isPublished: false },
      { approvalStatus: { not: ProductApprovalStatus.APPROVED } },
    ],
  };

  const before = await prisma.product.count({ where: targetWhere });

  if (before === 0) {
    console.log('No products need publishing or approval.');
    return;
  }

  const result = await prisma.product.updateMany({
    where: targetWhere,
    data: {
      isPublished: true,
      approvalStatus: ProductApprovalStatus.APPROVED,
    },
  });

  const storefrontVisible = await prisma.product.count({
    where: {
      isActive: true,
      isPublished: true,
      approvalStatus: ProductApprovalStatus.APPROVED,
      category: {
        isActive: true,
      },
    },
  });

  const inactiveCount = await prisma.product.count({
    where: {
      isActive: false,
    },
  });

  console.log(
    JSON.stringify(
      {
        updatedProducts: result.count,
        storefrontVisible,
        inactiveProductsStillHidden: inactiveCount,
        includeInactive,
      },
      null,
      2,
    ),
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
