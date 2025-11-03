-- AlterTable
ALTER TABLE `User`
    ADD COLUMN `gender` VARCHAR(191) NULL,
    ADD COLUMN `bio` TEXT NULL,
    ADD COLUMN `dateOfBirth` DATETIME(3) NULL,
    ADD COLUMN `addressStreet` VARCHAR(191) NULL,
    ADD COLUMN `addressHouse` VARCHAR(191) NULL,
    ADD COLUMN `addressCity` VARCHAR(191) NULL,
    ADD COLUMN `addressState` VARCHAR(191) NULL,
    ADD COLUMN `addressCountry` VARCHAR(191) NULL,
    ADD COLUMN `profilePhotoKey` VARCHAR(191) NULL,
    ADD COLUMN `profilePhotoUrl` VARCHAR(512) NULL;
