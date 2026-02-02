-- Fix api_keys table by dropping foreign key constraints and making columns nullable
ALTER TABLE api_keys DROP CONSTRAINT IF EXISTS api_keys_sub_organisation_id_fkey;
ALTER TABLE api_keys DROP CONSTRAINT IF EXISTS api_keys_user_id_fkey;
ALTER TABLE api_keys ALTER COLUMN sub_organisation_id DROP NOT NULL;
ALTER TABLE api_keys ALTER COLUMN user_id DROP NOT NULL;
