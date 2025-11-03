-- AlterTable
ALTER TABLE `Academy`
    ADD COLUMN `rejectionReason` VARCHAR(191) NULL,
    ADD COLUMN `reviewedAt` DATETIME(3) NULL,
    ADD COLUMN `reviewedById` VARCHAR(191) NULL,
    ADD COLUMN `status` ENUM('PENDING', 'APPROVED', 'REJECTED') NOT NULL DEFAULT 'PENDING';

-- Backfill existing academies as approved to avoid blocking current owners
UPDATE `Academy`
SET `status` = 'APPROVED'
WHERE `status` = 'PENDING';

-- CreateIndex
CREATE INDEX `Academy_status_idx` ON `Academy`(`status`);

-- AddForeignKey
ALTER TABLE `Academy`
    ADD CONSTRAINT `Academy_reviewedById_fkey` FOREIGN KEY (`reviewedById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
