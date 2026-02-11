import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://vqehwhdlujoajuqunyzu.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZxZWh3aGRsdWpvYWp1cXVueXp1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA4MzUwNjEsImV4cCI6MjA4NjQxMTA2MX0.UQK7jxuiaiHktTshedz9dbKFpD-aDpIUyQJw6xs7nNU'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
