const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
require('dotenv').config();

// Connect without specifying the database first to create it if needed
const adminPool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT) || 5432,
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  database: 'postgres', // connect to default db
});

async function seed() {
  const dbName = process.env.DB_NAME || 'taskflow';

  try {
    // Check if database exists
    const dbCheck = await adminPool.query(
      `SELECT 1 FROM pg_database WHERE datname = $1`,
      [dbName]
    );

    if (dbCheck.rows.length === 0) {
      console.log(`📦 Criando banco de dados "${dbName}"...`);
      await adminPool.query(`CREATE DATABASE ${dbName}`);
      console.log(`✅ Banco de dados "${dbName}" criado com sucesso!`);
    } else {
      console.log(`✅ Banco de dados "${dbName}" já existe.`);
    }

    await adminPool.end();

    // Now connect to the taskflow database
    const appPool = new Pool({
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT) || 5432,
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || 'postgres',
      database: dbName,
    });

    // Run schema
    const schemaPath = path.join(__dirname, 'schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf-8');
    console.log('🔧 Executando schema...');
    await appPool.query(schema);
    console.log('✅ Schema executado com sucesso!');

    // Seed default columns
    const existingColumns = await appPool.query('SELECT COUNT(*) FROM columns');
    if (parseInt(existingColumns.rows[0].count) === 0) {
      console.log('🌱 Inserindo colunas padrão...');
      await appPool.query(`
        INSERT INTO columns (name, position) VALUES
        ('A Fazer', 0),
        ('Em Progresso', 1),
        ('Concluído', 2)
      `);
      console.log('✅ Colunas padrão inseridas!');
    } else {
      console.log('✅ Colunas já existem, pulando seed.');
    }

    await appPool.end();
    console.log('\n🚀 Banco de dados pronto! Execute "npm run dev" para iniciar o servidor.');
  } catch (error) {
    console.error('❌ Erro no seed:', error.message);
    process.exit(1);
  }
}

seed();
