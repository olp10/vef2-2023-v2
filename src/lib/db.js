import { readFile } from 'fs/promises';
import pg from 'pg';

const SCHEMA_FILE = './sql/schema.sql';
const DROP_SCHEMA_FILE = './sql/drop.sql';

const { DATABASE_URL: connectionString, NODE_ENV: nodeEnv = 'development' } =
  process.env;

if (!connectionString) {
  console.error('vantar DATABASE_URL í .env');
  process.exit(-1);
}

// Notum SSL tengingu við gagnagrunn ef við erum *ekki* í development
// mode, á heroku, ekki á local vél
const ssl = nodeEnv === 'production' ? { rejectUnauthorized: false } : false;

const pool = new pg.Pool({ connectionString, ssl });

pool.on('error', (err) => {
  console.error('Villa í tengingu við gagnagrunn, forrit hættir', err);
  process.exit(-1);
});

export async function query(q, values = []) {
  let client;
  try {
    client = await pool.connect();
  } catch (e) {
    console.error('unable to get client from pool', e);
    return null;
  }

  try {
    const result = await client.query(q, values);
    return result;
  } catch (e) {
    if (nodeEnv !== 'test') {
      console.error('unable to query', e);
    }
    return null;
  } finally {
    client.release();
  }
}

export async function createSchema(schemaFile = SCHEMA_FILE) {
  const data = await readFile(schemaFile);

  return query(data.toString('utf-8'));
}

export async function dropSchema(dropFile = DROP_SCHEMA_FILE) {
  const data = await readFile(dropFile);

  return query(data.toString('utf-8'));
}

export async function createEvent({ name, slug, description, location, url } = {}) {
  const q = `
    INSERT INTO events
      (name, slug, description, location, url)
    VALUES
      ($1, $2, $3, $4, $5)
    RETURNING id, name, slug, description, location, url;
  `;
  const values = [name, slug, description, location, url];
  const result = await query(q, values);

  if (result && result.rowCount === 1) {
    return result.rows[0];
  }

  return null;
}

// Updatear ekki description, erum ekki að útfæra partial update
export async function updateEvent(id, { name, slug, description, location, url } = {}) {
  const q = `
    UPDATE events
      SET
        name = $1,
        slug = $2,
        description = $3,
        location = $4,
        url = $5,
        updated = CURRENT_TIMESTAMP
    WHERE
      id = $6
    RETURNING id, name, slug, description, location, url;
  `;
  const values = [name, slug, description, location, url, id];
  const result = await query(q, values);

  if (result && result.rowCount === 1) {
    return result.rows[0];
  }

  return null;
}


export async function removeRegistrationsFromEvent(id) {
  const q = `
    DELETE FROM registrations
    WHERE event=$1;
  `;
  const values = [id];
  const result = await query(q, values);

  if (result && result.rowCount === 1) {
    return result.rows[0];
  }

  return null;
}

export async function removeEvent(id) {
  removeRegistrationsFromEvent(id);
  const q = `
    DELETE FROM events
    WHERE id=$1;
  `;
  const values = [id];
  const result = await query(q, values);

  if (result && result.rowCount === 1) {
    return result.rows[0];
  }

  return null;
}

export async function registerUser(name, username, password) {
  const q = `
    INSERT INTO users
      (name, username, password)
    VALUES
      ($1, $2, $3)
    RETURNING
      id, name, username, password;
  `;
  const values = [name, username, password];
  const result = await query(q, values);

  if (result && result.rowCount === 1) {
    return result.rows[0];
  }

  return null;
}

export async function register({ name, comment, event } = {}) {
  const q = `
    INSERT INTO registrations
      (name, comment, event)
    VALUES
      ($1, $2, $3)
    RETURNING
      id, name, comment, event;
  `;
  const values = [name, comment, event];
  const result = await query(q, values);

  if (result && result.rowCount === 1) {
    return result.rows[0];
  }

  return null;
}

export async function listEvents(offset = 0, limit = 10) {
  const q = `
    SELECT
      id, name, slug, description, created, updated
    FROM
      events
    ORDER BY
      id OFFSET $1 LIMIT $2
  `;

  const result = await query(q, [offset, limit]);

  if (result) {
    return result.rows;
  }

  return null;
}

export async function totalNumOfEvents() {
  const q = `
    SELECT
      COUNT(*)
    FROM
      events
  `;

  const result = await query(q, []);

  if (result) {
    return result.rows[0];
  }

  return null;
}

export async function listEvent(slug) {
  const q = `
    SELECT
      id, name, slug, description, created, updated, location, url
    FROM
      events
    WHERE slug = $1
  `;

  const result = await query(q, [slug]);

  if (result && result.rowCount === 1) {
    return result.rows[0];
  }

  return null;
}

// TODO gætum fellt þetta fall saman við það að ofan
export async function listEventByName(name) {
  const q = `
    SELECT
      id, name, slug, description, created, updated
    FROM
      events
    WHERE name = $1
  `;

  const result = await query(q, [name]);

  if (result && result.rowCount === 1) {
    return result.rows[0];
  }

  return null;
}


export async function unRegister(name, event) {
  const q = `
    DELETE
    FROM
      registrations
    WHERE event = $1
    AND name = $2
  `;

  const result = await query(q, [event, name]);

  if (result) {
    return result.rows;
  }

  return null;
}

export async function isAlreadyRegistered(name, event) {
  const q = `
    SELECT
      name
    FROM
      registrations
    WHERE event = $1
    AND name = $2
  `;

  const result = await query(q, [event, name]);

  if (result && result.rowCount > 0) {
    return true;
  }

  return false;
}

export async function listRegistered(event) {
  const q = `
    SELECT
      id, name, comment
    FROM
      registrations
    WHERE event = $1
  `;

  const result = await query(q, [event]);

  if (result) {
    return result.rows;
  }

  return null;
}

export async function end() {
  await pool.end();
}
