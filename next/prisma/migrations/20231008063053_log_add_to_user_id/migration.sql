/*
  Warnings:

  - You are about to drop the column `content` on the `Log` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE `Log` DROP COLUMN `content`,
    ADD COLUMN `page` VARCHAR(191) NULL,
    ADD COLUMN `query` VARCHAR(191) NULL,
    ADD COLUMN `userId` VARCHAR(191) NULL;
