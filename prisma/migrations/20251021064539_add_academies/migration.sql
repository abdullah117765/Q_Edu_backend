/*
  Warnings:

  - Added the required column `academyId` to the `Class` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE `Class` ADD COLUMN `academyId` VARCHAR(191) NOT NULL;

-- AlterTable
ALTER TABLE `Resource` ADD COLUMN `academyId` VARCHAR(191) NULL;

-- CreateTable
CREATE TABLE `Academy` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `slug` VARCHAR(191) NOT NULL,
    `description` VARCHAR(191) NULL,
    `ownerId` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Academy_slug_key`(`slug`),
    UNIQUE INDEX `Academy_ownerId_key`(`ownerId`),
    INDEX `Academy_name_idx`(`name`),
    INDEX `Academy_ownerId_idx`(`ownerId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AcademyMembership` (
    `id` VARCHAR(191) NOT NULL,
    `academyId` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `role` ENUM('TEACHER', 'STUDENT') NOT NULL,
    `status` ENUM('PENDING', 'APPROVED', 'REJECTED', 'REVOKED') NOT NULL DEFAULT 'PENDING',
    `requestedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `respondedAt` DATETIME(3) NULL,
    `reason` VARCHAR(191) NULL,
    `actionedById` VARCHAR(191) NULL,

    INDEX `AcademyMembership_userId_status_idx`(`userId`, `status`),
    INDEX `AcademyMembership_academyId_status_idx`(`academyId`, `status`),
    INDEX `AcademyMembership_status_idx`(`status`),
    UNIQUE INDEX `AcademyMembership_academyId_userId_key`(`academyId`, `userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `Class_academyId_idx` ON `Class`(`academyId`);

-- CreateIndex
CREATE INDEX `Resource_academyId_idx` ON `Resource`(`academyId`);

-- AddForeignKey
ALTER TABLE `Academy` ADD CONSTRAINT `Academy_ownerId_fkey` FOREIGN KEY (`ownerId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AcademyMembership` ADD CONSTRAINT `AcademyMembership_academyId_fkey` FOREIGN KEY (`academyId`) REFERENCES `Academy`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AcademyMembership` ADD CONSTRAINT `AcademyMembership_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AcademyMembership` ADD CONSTRAINT `AcademyMembership_actionedById_fkey` FOREIGN KEY (`actionedById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Class` ADD CONSTRAINT `Class_academyId_fkey` FOREIGN KEY (`academyId`) REFERENCES `Academy`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Resource` ADD CONSTRAINT `Resource_academyId_fkey` FOREIGN KEY (`academyId`) REFERENCES `Academy`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
