-- Add organization_id to smtp_config and allow one config per org
ALTER TABLE smtp_config ADD COLUMN IF NOT EXISTS organization_id INTEGER REFERENCES organizations(id) ON DELETE CASCADE;

-- If an existing global config exists, leave organization_id NULL (it becomes the fallback/legacy row)
-- Add a unique constraint: one config per organization (NULL org_id = legacy global)
CREATE UNIQUE INDEX IF NOT EXISTS smtp_config_org_unique ON smtp_config (organization_id) WHERE organization_id IS NOT NULL;
