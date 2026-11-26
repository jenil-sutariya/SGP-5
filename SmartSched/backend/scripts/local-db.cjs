// Local PostgreSQL maintenance helper. Credentials stay in the child environment.
const fs = require('node:fs');
const {spawnSync} = require('node:child_process');
require('dotenv').config({path:'.env.development', quiet:true});
require('dotenv').config({path:'.env', quiet:true});
const u = new URL(process.env.DATABASE_URL);
const args = process.argv.slice(2);
const result=spawnSync(process.env.PSQL_PATH || (fs.existsSync('C:/Program Files/PostgreSQL/18/bin/psql.exe') ? 'C:/Program Files/PostgreSQL/18/bin/psql.exe' : 'psql'), ['-X','-v','ON_ERROR_STOP=1','-h',u.hostname,'-p',u.port||'5432','-U',decodeURIComponent(u.username),'-d',process.env.SMARTSCHED_TEST_DB || u.pathname.slice(1),...args], {env:{...process.env,PGPASSWORD:decodeURIComponent(u.password)},encoding:'utf8',maxBuffer:20*1024*1024});
process.stdout.write(result.stdout||''); process.stderr.write(result.stderr||''); if(result.error) console.error(result.error.message); process.exit(result.status??1);
