/*
  Warnings:

  - You are about to drop the column `crypted_password` on the `User` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE `User` DROP COLUMN `crypted_password`,
    ADD COLUMN `password` VARCHAR(255) NULL;
