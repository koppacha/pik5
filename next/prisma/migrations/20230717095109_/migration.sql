/*
  Warnings:

  - Made the column `userId` on table `User` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE `User` MODIFY `userId` VARCHAR(191) NOT NULL;
