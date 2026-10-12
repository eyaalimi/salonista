-- Ajouter une valeur d'enum dans sa propre migration : Postgres refuse
-- d'utiliser une valeur ajoutee dans la meme transaction.
ALTER TYPE "SubscriptionModule" ADD VALUE IF NOT EXISTS 'PREMIUM';
