/*
  Warnings:

  - You are about to alter the column `profilePhotoUrl` on the `User` table. The data in that column could be lost. The data in that column will be cast from `VarChar(512)` to `VarChar(191)`.

*/
-- AlterTable
ALTER TABLE `User` MODIFY `bio` VARCHAR(191) NULL,
    MODIFY `profilePhotoUrl` VARCHAR(191) NULL;
