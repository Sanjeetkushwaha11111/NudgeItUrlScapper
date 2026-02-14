const { PrismaClient } = require('@prisma/client');
const { Pool } = require('pg');

let PrismaPg;
try {
    ({ PrismaPg } = require('@prisma/adapter-pg'));
} catch (err) {
    const e = new Error(
        'Missing Prisma Postgres adapter. Run: npm install @prisma/adapter-pg'
    );
    e.code = 'missing_prisma_adapter';
    e.cause = err;
    throw e;
}

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
    throw new Error('DATABASE_URL is missing. Set it in .env');
}

const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);

const prisma = new PrismaClient({
    adapter,
    log: ['query', 'info', 'warn', 'error'],
});

module.exports = prisma;
