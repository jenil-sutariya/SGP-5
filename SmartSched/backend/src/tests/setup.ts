process.env.NODE_ENV = 'test';
process.env.DATABASE_URL =
  process.env.DATABASE_URL ||
  'postgresql://smartsched:smartsched_secret@localhost:5432/smartsched?schema=public';
process.env.JWT_ACCESS_SECRET = 'test_access_secret_key_32_characters!!';
process.env.JWT_REFRESH_SECRET = 'test_refresh_secret_key_32_characters!';
