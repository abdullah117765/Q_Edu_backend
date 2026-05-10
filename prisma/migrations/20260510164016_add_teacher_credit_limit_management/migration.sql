-- AlterTable
ALTER TABLE `ZoomCreditBalance` ADD COLUMN `teacherLimit` INTEGER NULL;

-- CreateTable
CREATE TABLE `TeacherCreditLimitHistory` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `academyId` VARCHAR(191) NOT NULL,
    `oldLimit` INTEGER NULL,
    `newLimit` INTEGER NULL,
    `changedBy` VARCHAR(191) NOT NULL,
    `reason` VARCHAR(191) NULL,
    `metadata` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `TeacherCreditLimitHistory_userId_createdAt_idx`(`userId`, `createdAt`),
    INDEX `TeacherCreditLimitHistory_academyId_idx`(`academyId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `TeacherCreditLimitHistory` ADD CONSTRAINT `TeacherCreditLimitHistory_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `ZoomCreditBalance`(`userId`) ON DELETE CASCADE ON UPDATE CASCADE;
