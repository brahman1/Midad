-- Ne pas considérer les anciennes sessions comme fraîchement authentifiées
-- lorsqu'une colonne de sécurité a reçu sa valeur par défaut à la migration.
UPDATE auth_sessions s SET reauthenticated_at=s.created_at
FROM schema_migrations m
WHERE m.version='005.sql' AND s.created_at<m.applied_at AND s.reauthenticated_at=m.applied_at;
UPDATE auth_sessions s SET last_seen_at=s.created_at
FROM schema_migrations m
WHERE m.version='005.sql' AND s.created_at<m.applied_at AND s.last_seen_at=m.applied_at;
