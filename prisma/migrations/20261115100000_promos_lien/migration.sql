-- Promos par liens wa.me : la gerante envoie depuis son propre WhatsApp,
-- une cliente a la fois, comme le message de fidelite. Pour les salons sans
-- connexion a l'API WhatsApp Cloud.
--
-- ADDITIVE. La valeur n'est utilisee nulle part dans cette migration :
-- PostgreSQL refuse d'employer une valeur d'enum dans la transaction qui l'a
-- creee.

ALTER TYPE "CanalPromo" ADD VALUE 'LIEN';
