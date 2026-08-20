-- Enforce that there can only be one admin in the user_roles table
CREATE UNIQUE INDEX user_roles_single_admin ON user_roles ((role)) WHERE role = 'admin';
