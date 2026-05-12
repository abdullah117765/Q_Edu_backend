-- CreateTable
CREATE TABLE `ClassRecording` (
    `id` VARCHAR(191) NOT NULL,
    `classId` VARCHAR(191) NOT NULL,
    `academyId` VARCHAR(191) NOT NULL,
    `teacherId` VARCHAR(191) NOT NULL,
    `source` ENUM('ZOOM_CLOUD', 'ZOOM_LOCAL') NOT NULL DEFAULT 'ZOOM_CLOUD',
    `zoomMeetingId` VARCHAR(191) NULL,
    `zoomRecordingId` VARCHAR(191) NULL,
    `topic` VARCHAR(191) NULL,
    `startTime` DATETIME(3) NULL,
    `endTime` DATETIME(3) NULL,
    `durationSeconds` INTEGER NULL,
    `fileSize` BIGINT NULL,
    `playUrl` VARCHAR(1024) NULL,
    `downloadUrl` VARCHAR(1024) NULL,
    `password` VARCHAR(191) NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'completed',
    `rawPayload` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `ClassRecording_zoomRecordingId_key`(`zoomRecordingId`),
    INDEX `ClassRecording_classId_idx`(`classId`),
    INDEX `ClassRecording_academyId_idx`(`academyId`),
    INDEX `ClassRecording_teacherId_idx`(`teacherId`),
    INDEX `ClassRecording_startTime_idx`(`startTime`),
    INDEX `ClassRecording_source_idx`(`source`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `ClassRecording` ADD CONSTRAINT `ClassRecording_classId_fkey` FOREIGN KEY (`classId`) REFERENCES `Class`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
