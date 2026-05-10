-- Improve user directory performance for ordering and common filter/search fields.
CREATE INDEX `User_createdAt_idx` ON `User`(`createdAt`);
CREATE INDEX `User_firstName_idx` ON `User`(`firstName`);
CREATE INDEX `User_lastName_idx` ON `User`(`lastName`);
