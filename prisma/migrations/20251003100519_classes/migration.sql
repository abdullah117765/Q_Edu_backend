/*
  Warnings:

  - A unique constraint covering the columns `[zoomUserId]` on the table `User` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE `User` ADD COLUMN `zoomUserId` VARCHAR(191) NULL;

-- CreateTable
CREATE TABLE `Class` (
    `id` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `description` VARCHAR(191) NULL,
    `teacherId` VARCHAR(191) NOT NULL,
    `status` ENUM('UPCOMING', 'ONGOING', 'ENDED', 'CANCELLED') NOT NULL DEFAULT 'UPCOMING',
    `scheduledStart` DATETIME(3) NOT NULL,
    `scheduledEnd` DATETIME(3) NOT NULL,
    `durationMinutes` INTEGER NOT NULL,
    `timezone` VARCHAR(191) NOT NULL,
    `creditsConsumed` INTEGER NULL,
    `zoomMeetingId` VARCHAR(191) NULL,
    `zoomHostId` VARCHAR(191) NULL,
    `zoomJoinUrl` VARCHAR(191) NULL,
    `zoomStartUrl` VARCHAR(191) NULL,
    `zoomPassword` VARCHAR(191) NULL,
    `zoomUuid` VARCHAR(191) NULL,
    `metadata` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Class_zoomMeetingId_key`(`zoomMeetingId`),
    INDEX `Class_teacherId_idx`(`teacherId`),
    INDEX `Class_scheduledStart_idx`(`scheduledStart`),
    INDEX `Class_status_scheduledStart_idx`(`status`, `scheduledStart`),
    INDEX `Class_zoomMeetingId_idx`(`zoomMeetingId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ClassParticipant` (
    `id` VARCHAR(191) NOT NULL,
    `classId` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NULL,
    `zoomParticipantUuid` VARCHAR(191) NULL,
    `email` VARCHAR(191) NULL,
    `displayName` VARCHAR(191) NULL,
    `role` ENUM('TEACHER', 'STUDENT', 'GUEST') NOT NULL DEFAULT 'STUDENT',
    `joinTime` DATETIME(3) NULL,
    `leaveTime` DATETIME(3) NULL,
    `durationSeconds` INTEGER NULL,
    `metadata` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `ClassParticipant_classId_idx`(`classId`),
    INDEX `ClassParticipant_userId_idx`(`userId`),
    INDEX `ClassParticipant_zoomParticipantUuid_idx`(`zoomParticipantUuid`),
    UNIQUE INDEX `ClassParticipant_classId_zoomParticipantUuid_key`(`classId`, `zoomParticipantUuid`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ZoomCreditBalance` (
    `userId` VARCHAR(191) NOT NULL,
    `balance` INTEGER NOT NULL DEFAULT 0,
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`userId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ZoomCreditTransaction` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `relatedUserId` VARCHAR(191) NULL,
    `classId` VARCHAR(191) NULL,
    `type` ENUM('CREDIT', 'DEBIT', 'TRANSFER_OUT', 'TRANSFER_IN') NOT NULL,
    `amount` INTEGER NOT NULL,
    `runningBalance` INTEGER NOT NULL,
    `reason` VARCHAR(191) NULL,
    `metadata` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `ZoomCreditTransaction_userId_createdAt_idx`(`userId`, `createdAt`),
    INDEX `ZoomCreditTransaction_classId_idx`(`classId`),
    INDEX `ZoomCreditTransaction_relatedUserId_idx`(`relatedUserId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ZoomCreditAuditLog` (
    `id` VARCHAR(191) NOT NULL,
    `transactionId` VARCHAR(191) NOT NULL,
    `actorId` VARCHAR(191) NULL,
    `action` ENUM('CREATED', 'UPDATED', 'REVERSED') NOT NULL DEFAULT 'CREATED',
    `details` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `ZoomCreditAuditLog_transactionId_idx`(`transactionId`),
    INDEX `ZoomCreditAuditLog_actorId_idx`(`actorId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE UNIQUE INDEX `User_zoomUserId_key` ON `User`(`zoomUserId`);

-- CreateIndex
CREATE INDEX `User_role_idx` ON `User`(`role`);

-- CreateIndex
CREATE INDEX `User_status_idx` ON `User`(`status`);

-- AddForeignKey
ALTER TABLE `Class` ADD CONSTRAINT `Class_teacherId_fkey` FOREIGN KEY (`teacherId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ClassParticipant` ADD CONSTRAINT `ClassParticipant_classId_fkey` FOREIGN KEY (`classId`) REFERENCES `Class`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ClassParticipant` ADD CONSTRAINT `ClassParticipant_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ZoomCreditBalance` ADD CONSTRAINT `ZoomCreditBalance_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ZoomCreditTransaction` ADD CONSTRAINT `ZoomCreditTransaction_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ZoomCreditTransaction` ADD CONSTRAINT `ZoomCreditTransaction_relatedUserId_fkey` FOREIGN KEY (`relatedUserId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ZoomCreditTransaction` ADD CONSTRAINT `ZoomCreditTransaction_classId_fkey` FOREIGN KEY (`classId`) REFERENCES `Class`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ZoomCreditAuditLog` ADD CONSTRAINT `ZoomCreditAuditLog_transactionId_fkey` FOREIGN KEY (`transactionId`) REFERENCES `ZoomCreditTransaction`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ZoomCreditAuditLog` ADD CONSTRAINT `ZoomCreditAuditLog_actorId_fkey` FOREIGN KEY (`actorId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
