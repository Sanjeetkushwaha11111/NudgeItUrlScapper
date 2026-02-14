require('dotenv').config();
const { Client } = require('pg');

async function main() {
    const url = process.env.DATABASE_URL;
    if (!url) {
        throw new Error('DATABASE_URL missing in .env');
    }

    const client = new Client({
        connectionString: url,
    });

    await client.connect();

    const res = await client.query(
        'SELECT now() as now, current_database() as db;'
    );

    console.log(res.rows[0]);

    await client.end();
}

main().catch((e) => {
    console.error('DB test failed:', e);
    process.exit(1);
});
