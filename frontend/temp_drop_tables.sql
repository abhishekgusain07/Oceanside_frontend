-- Drop the problematic tables that have text IDs instead of UUID
DROP TABLE IF EXISTS participants CASCADE;
DROP TABLE IF EXISTS sessions CASCADE; 