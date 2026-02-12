
import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'

// Load env vars manually
const envPath = path.resolve('.env')
const envConfig = {}

if (fs.existsSync(envPath)) {
    const envFile = fs.readFileSync(envPath, 'utf8')
    envFile.split('\n').forEach(line => {
        // Skip comments and empty lines
        if (!line || line.startsWith('#')) return

        let [key, ...value] = line.split('=')
        if (key && value) {
            key = key.trim()
            let val = value.join('=').trim()

            // Remove quotes if present
            if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
                val = val.slice(1, -1)
            }

            envConfig[key] = val
        }
    })
}

const supabaseUrl = envConfig.VITE_SUPABASE_URL
const supabaseKey = envConfig.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase credentials in .env')
    process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function checkAdminUser() {
    console.log('Checking user teste@gmail.com...')

    // 1. Try to sign in to check if credentials work
    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
        email: 'teste@gmail.com',
        password: '123456' // The password we think it is
    })

    if (signInError) {
        console.error('❌ Login failed:', signInError.message)
    } else {
        console.log('✅ Login successful for teste@gmail.com')
        console.log('User ID:', signInData.user.id)

        // 2. Check admin_users table
        const { data: adminData, error: adminError } = await supabase
            .from('admin_users')
            .select('*')
            .eq('id', signInData.user.id)
            .single()

        if (adminError) {
            console.error('❌ User is NOT in admin_users table:', adminError.message)
        } else {
            console.log('✅ User found in admin_users:', adminData)
        }
    }
}

checkAdminUser()
