-- Contact message inbox for public contact form submissions.
CREATE TABLE `ContactMessage` (
  `id` VARCHAR(191) NOT NULL,
  `name` VARCHAR(191) NOT NULL,
  `email` VARCHAR(191) NOT NULL,
  `subject` VARCHAR(191) NULL,
  `message` TEXT NOT NULL,
  `status` ENUM('NEW', 'IN_REVIEW', 'RESOLVED', 'SPAM') NOT NULL DEFAULT 'NEW',
  `sourceUrl` VARCHAR(191) NULL,
  `metadata` JSON NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE INDEX `ContactMessage_status_createdAt_idx` ON `ContactMessage`(`status`, `createdAt`);
CREATE INDEX `ContactMessage_email_idx` ON `ContactMessage`(`email`);
