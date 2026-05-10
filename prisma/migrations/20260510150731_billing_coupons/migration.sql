-- CreateTable
CREATE TABLE `Coupon` (
    `id` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `description` VARCHAR(191) NULL,
    `discountType` ENUM('PERCENT', 'AMOUNT') NOT NULL DEFAULT 'PERCENT',
    `percentOff` INTEGER NULL,
    `amountOffCents` INTEGER NULL,
    `currency` VARCHAR(191) NOT NULL DEFAULT 'USD',
    `duration` ENUM('ONCE', 'REPEATING', 'FOREVER') NOT NULL DEFAULT 'ONCE',
    `durationMonths` INTEGER NULL,
    `appliesTo` ENUM('ALL', 'PACKAGES', 'PLANS') NOT NULL DEFAULT 'ALL',
    `maxRedemptions` INTEGER NULL,
    `timesRedeemed` INTEGER NOT NULL DEFAULT 0,
    `startsAt` DATETIME(3) NULL,
    `expiresAt` DATETIME(3) NULL,
    `active` BOOLEAN NOT NULL DEFAULT true,
    `highlight` BOOLEAN NOT NULL DEFAULT false,
    `marketingTitle` VARCHAR(191) NULL,
    `marketingBody` VARCHAR(191) NULL,
    `stripeCouponId` VARCHAR(191) NULL,
    `stripePromotionCodeId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Coupon_code_key`(`code`),
    UNIQUE INDEX `Coupon_stripeCouponId_key`(`stripeCouponId`),
    UNIQUE INDEX `Coupon_stripePromotionCodeId_key`(`stripePromotionCodeId`),
    INDEX `Coupon_active_idx`(`active`),
    INDEX `Coupon_expiresAt_idx`(`expiresAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CouponRedemption` (
    `id` VARCHAR(191) NOT NULL,
    `couponId` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NULL,
    `paymentId` VARCHAR(191) NULL,
    `amountOffCents` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `CouponRedemption_couponId_idx`(`couponId`),
    INDEX `CouponRedemption_userId_idx`(`userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `CouponRedemption` ADD CONSTRAINT `CouponRedemption_couponId_fkey` FOREIGN KEY (`couponId`) REFERENCES `Coupon`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
