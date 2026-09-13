-- Only storage is widened. New submissions and edits retain the API/UI length limits.
ALTER TABLE `limitedIdeas`
    ADD COLUMN `legacyId` VARCHAR(191) NULL,
    MODIFY `ruleName` TEXT NOT NULL,
    MODIFY `body` MEDIUMTEXT NOT NULL;

CREATE INDEX `limitedIdeas_legacyId_idx` ON `limitedIdeas` (`legacyId`);
