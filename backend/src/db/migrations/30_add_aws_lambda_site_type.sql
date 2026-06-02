-- Migration 30: Add aws_lambda to sites site_type check constraint
ALTER TABLE sites DROP CONSTRAINT sites_site_type_check;
ALTER TABLE sites ADD CONSTRAINT sites_site_type_check CHECK (site_type IN ('docker', 'kubernetes', 'generic', 'aws_lambda'));
