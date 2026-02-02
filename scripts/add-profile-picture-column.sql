-- ==============================================================
-- RUN THIS ON THE MAIN DATABASE (organisation_ticket_sales)
-- ==============================================================
-- In pgAdmin: Right-click on "organisation_ticket_sales" database -> Query Tool
-- Then run this script
-- ==============================================================

-- Add profile picture column to erp_users table
ALTER TABLE erp_users 
ADD COLUMN IF NOT EXISTS profile_picture VARCHAR(500),
ADD COLUMN IF NOT EXISTS phone VARCHAR(20);

-- Create uploads directory structure (do this manually in terminal)
-- Windows: mkdir public\uploads\profiles
-- Linux/Mac: mkdir -p public/uploads/profiles
