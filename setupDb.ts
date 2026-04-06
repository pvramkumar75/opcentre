import { Client } from 'pg';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

const connectionString = process.env.DATABASE_URL || 'postgresql://neondb_owner:npg_GL0VvYlcCH3i@ep-purple-feather-a1xwczh8-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require';

async function setupDatabase() {
  const client = new Client({
    connectionString,
    ssl: {
      rejectUnauthorized: false,
    },
  });

  try {
    await client.connect();
    console.log('✓ Connected to Neon database');

    // Read and execute the SQL setup file
    const sqlPath = path.join(process.cwd(), 'setup.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');

    await client.query(sql);
    console.log('✓ Tables created and default data inserted');

    console.log('\n✅ Database setup complete!');
    console.log('\nNext steps:');
    console.log('1. Go to https://supabase.com and sign up');
    console.log('2. Create a new project and choose "Connect external database"');
    console.log('3. Use your Neon connection string');
    console.log('4. Get your Supabase URL and anon key from project settings');
    console.log('5. Update .env with those credentials');

  } catch (error) {
    console.error('❌ Error setting up database:', error);
  } finally {
    await client.end();
  }
}

setupDatabase();
