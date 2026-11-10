/**
 * Security tests for supabase/schema.sql.
 *
 * The real schema file is loaded into a real PostgreSQL database (PGlite),
 * and every statement below runs under the same database roles Supabase uses:
 *   anon           a guest of the website (nobody signed in)
 *   authenticated  a signed-in account
 * so the Row Level Security rules are exercised for real.
 *
 * Run with:  npm test   (inside tests/backend)
 */
import { PGlite } from '@electric-sql/pglite';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { before, describe, test } from 'node:test';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const stub = fs.readFileSync(path.join(here, 'supabase-stub.sql'), 'utf8');
const schema = fs.readFileSync(path.join(here, '../../supabase/schema.sql'), 'utf8');

let db;
let admin;
let stranger;

/** Runs SQL as a database role, with the signed-in user's id attached, inside a transaction. */
async function as(role, userId, sql, params = []) {
  return db.transaction(async (tx) => {
    const claims = userId ? { role, sub: userId } : { role };
    await tx.query(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify(claims)]);
    await tx.exec(`set local role ${role}`);
    return (await tx.query(sql, params)).rows;
  });
}
const guest = (sql, params) => as('anon', null, sql, params);
const asAdmin = (sql, params) => as('authenticated', admin, sql, params);
const asStranger = (sql, params) => as('authenticated', stranger, sql, params);

async function refused(promise, pattern) {
  await assert.rejects(promise, (error) => {
    if (pattern) assert.match(`${error.code} ${error.message}`, pattern);
    return true;
  });
}

const RSVP = `insert into public.rsvps (guest_name, mobile, guest_count, events, message) values ($1, $2, $3, $4::jsonb, $5)`;
const goodRsvp = ['Asha Verma', '9876543210', 2, JSON.stringify([{ id: 'wedding', name: 'Wedding' }]), 'Congratulations!'];
const content = (overrides = {}) => JSON.stringify({ couple: { brideName: 'Shaifali Singh' }, rsvp: { enabled: true, maxGuests: 10 }, ...overrides });

before(async () => {
  db = new PGlite();
  await db.exec(stub);
  await db.exec(schema);
  admin = (await db.query(`insert into auth.users (email) values ('couple@example.com') returning id`)).rows[0].id;
  stranger = (await db.query(`insert into auth.users (email) values ('stranger@example.com') returning id`)).rows[0].id;
  await db.query(`select public.grant_admin('couple@example.com')`);
});

describe('setup', () => {
  test('the schema file can be run a second time without errors or data loss', async () => {
    await asAdmin(`insert into public.site_content (id, content) values ('draft', $1::jsonb)`, [content()]);
    await db.exec(schema);
    const rows = await asAdmin(`select id from public.site_content`);
    assert.deepEqual(rows.map((row) => row.id), ['draft']);
    assert.equal((await asAdmin(`select public.is_admin() as ok`))[0].ok, true);
  });

  test('grant_admin refuses an email that has no account', async () => {
    await refused(db.query(`select public.grant_admin('nobody@example.com')`), /No user with the email/);
  });

  test('every table has Row Level Security switched on', async () => {
    const rows = (await db.query(`select relname, relrowsecurity from pg_class where relnamespace = 'public'::regnamespace and relkind = 'r' order by relname`)).rows;
    assert.deepEqual(rows.map((row) => row.relname), ['admins', 'rsvps', 'site_content', 'site_versions']);
    for (const row of rows) assert.equal(row.relrowsecurity, true, `${row.relname} must have RLS enabled`);
  });
});

describe('administrator: content', () => {
  test('is recognised as an administrator', async () => {
    assert.equal((await asAdmin(`select public.is_admin() as ok`))[0].ok, true);
  });

  test('saving the draft raises the revision and records who saved it', async () => {
    const before = (await asAdmin(`select revision from public.site_content where id = 'draft'`))[0].revision;
    const rows = await asAdmin(`update public.site_content set content = $1::jsonb where id = 'draft' and revision = $2 returning revision, updated_by`, [
      content({ note: 'edited' }),
      before,
    ]);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].revision, before + 1);
    assert.equal(rows[0].updated_by, admin);
  });

  test('a save based on an old revision changes nothing, which is how edit conflicts are caught', async () => {
    const rows = await asAdmin(`update public.site_content set content = $1::jsonb where id = 'draft' and revision = 1 returning revision`, [content({ note: 'stale' })]);
    assert.equal(rows.length, 0);
  });

  test('publishing copies the draft to the published row and records a version', async () => {
    const revision = (await asAdmin(`select revision from public.site_content where id = 'draft'`))[0].revision;
    await asAdmin(`select * from public.publish_site($1)`, [revision]);
    const rows = await asAdmin(`select id, content from public.site_content order by id`);
    assert.equal(rows.length, 2);
    assert.deepEqual(rows[0].content, rows[1].content);
    assert.equal((await asAdmin(`select count(*)::int as n from public.site_versions`))[0].n, 1);
  });

  test('publishing with an out-of-date revision is refused', async () => {
    await refused(asAdmin(`select * from public.publish_site(1)`), /draft_changed/);
  });

  test('only the ids "draft" and "published" are accepted, and oversized content is refused', async () => {
    await refused(asAdmin(`insert into public.site_content (id, content) values ('other', '{}'::jsonb)`), /23514|check constraint/);
    const huge = JSON.stringify({ blob: Array.from({ length: 60000 }, (_, i) => `${i}-${Math.random()}`) });
    await refused(asAdmin(`update public.site_content set content = $1::jsonb where id = 'draft'`, [huge]), /23514|check constraint/);
  });

  test('the publishing history keeps only the 30 most recent versions', async () => {
    for (let i = 0; i < 33; i += 1) {
      await asAdmin(`update public.site_content set content = $1::jsonb where id = 'draft'`, [content({ step: i })]);
      await asAdmin(`select * from public.publish_site(null)`);
    }
    assert.equal((await asAdmin(`select count(*)::int as n from public.site_versions`))[0].n, 30);
  });

  test('cannot delete content rows or rewrite the publishing history directly', async () => {
    await refused(asAdmin(`delete from public.site_content where id = 'draft'`), /42501|permission denied/);
    await refused(asAdmin(`delete from public.site_versions`), /42501|permission denied/);
    await refused(asAdmin(`update public.site_content set revision = 999 where id = 'draft'`), /42501|permission denied/);
  });
});

describe('guest (nobody signed in): content', () => {
  test('can read the published website', async () => {
    const rows = await guest(`select id from public.site_content`);
    assert.deepEqual(rows.map((row) => row.id), ['published']);
  });

  test('cannot see the draft', async () => {
    assert.equal((await guest(`select * from public.site_content where id = 'draft'`)).length, 0);
  });

  test('cannot create, change or delete content', async () => {
    await refused(guest(`insert into public.site_content (id, content) values ('draft', '{}'::jsonb)`), /42501|permission denied/);
    await refused(guest(`update public.site_content set content = '{}'::jsonb where id = 'published'`), /42501|permission denied/);
    await refused(guest(`delete from public.site_content`), /42501|permission denied/);
  });

  test('cannot publish, read the history, or see who the administrators are', async () => {
    await refused(guest(`select * from public.publish_site(null)`), /42501|permission denied/);
    await refused(guest(`select * from public.site_versions`), /42501|permission denied/);
    await refused(guest(`select * from public.admins`), /42501|permission denied/);
    assert.equal((await guest(`select public.is_admin() as ok`))[0].ok, false);
  });

  test('cannot make themselves an administrator', async () => {
    await refused(guest(`select public.grant_admin('stranger@example.com')`), /42501|permission denied/);
    await refused(guest(`insert into public.admins (user_id) values ($1)`, [stranger]), /42501|permission denied/);
  });
});

describe('guest: RSVP', () => {
  test('can send an RSVP', async () => {
    await guest(RSVP, goodRsvp);
    const rows = await asAdmin(`select guest_name, mobile, guest_count, admin_note from public.rsvps`);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].guest_name, 'Asha Verma');
    assert.equal(rows[0].admin_note, null);
  });

  test('can say that they cannot attend', async () => {
    await guest(RSVP, ['Ravi Kumar', '+919811122233', 0, '[]', 'Our best wishes to you both']);
    assert.equal((await asAdmin(`select count(*)::int as n from public.rsvps where guest_count = 0`))[0].n, 1);
  });

  test('cannot read the guest list, not even a row count', async () => {
    await refused(guest(`select * from public.rsvps`), /42501|permission denied/);
    await refused(guest(`select count(*) from public.rsvps`), /42501|permission denied/);
    await refused(guest(`${RSVP} returning id`, goodRsvp), /42501|permission denied/);
  });

  test('cannot change or delete any response', async () => {
    await refused(guest(`update public.rsvps set guest_count = 40`), /42501|permission denied/);
    await refused(guest(`delete from public.rsvps`), /42501|permission denied/);
  });

  test('cannot set fields reserved for the system or the administrator', async () => {
    await refused(guest(`insert into public.rsvps (guest_name, mobile, guest_count, admin_note) values ('X Y', '9876500000', 1, 'hello')`), /42501|permission denied/);
    await refused(guest(`insert into public.rsvps (guest_name, mobile, guest_count, created_at) values ('X Y', '9876500000', 1, '2020-01-01')`), /42501|permission denied/);
  });

  test('invalid details are refused by the database itself', async () => {
    const bad = [
      ['A', '9876543210', 1, '[]', null], // name too short
      ['Asha Verma', '12345', 1, '[]', null], // mobile too short
      ['Asha Verma', 'call me maybe', 1, '[]', null], // mobile not a number
      ['Asha Verma', '9876543210', 51, '[]', null], // absurd party size
      ['Asha Verma', '9876543210', -1, '[]', null],
      ['Asha Verma', '9876543210', 1, '{"not":"a list"}', null],
      ['Asha Verma', '9876543210', 0, JSON.stringify([{ id: 'wedding', name: 'Wedding' }]), null], // declining yet attending
      ['Asha Verma', '9876543210', 1, '[]', 'x'.repeat(1001)], // message too long
    ];
    for (const row of bad) await refused(guest(RSVP, row));
  });

  test('a party larger than the limit set in the dashboard is refused', async () => {
    await refused(guest(RSVP, ['Big Family', '9000000001', 11, '[]', null]), /42501|row-level security/);
    await guest(RSVP, ['Big Family', '9000000001', 10, '[]', null]);
  });

  test('names are tidied and the time of the response cannot be forged', async () => {
    await guest(RSVP, ['   Meera    Nair  ', '9000000002', 1, '[]', '   ']);
    const row = (await asAdmin(`select guest_name, message, created_at from public.rsvps where mobile = '9000000002'`))[0];
    assert.equal(row.guest_name, 'Meera Nair');
    assert.equal(row.message, null);
    assert.ok(Math.abs(Date.now() - new Date(row.created_at).getTime()) < 60_000);
  });

  test('the same mobile number cannot flood the list', async () => {
    for (let i = 0; i < 8; i += 1) await guest(RSVP, ['Repeat Sender', '9000000003', 1, '[]', null]);
    await refused(guest(RSVP, ['Repeat Sender', '9000000003', 1, '[]', null]), /rsvp_rate_limited/);
  });

  test('when RSVPs are switched off and published, the database refuses new responses', async () => {
    await asAdmin(`update public.site_content set content = $1::jsonb where id = 'draft'`, [content({ rsvp: { enabled: false, maxGuests: 10 } })]);
    await asAdmin(`select * from public.publish_site(null)`);
    await refused(guest(RSVP, ['Late Guest', '9000000004', 1, '[]', null]), /42501|row-level security/);
    await asAdmin(`update public.site_content set content = $1::jsonb where id = 'draft'`, [content()]);
    await asAdmin(`select * from public.publish_site(null)`);
    await guest(RSVP, ['Late Guest', '9000000004', 1, '[]', null]);
  });
});

describe('a signed-in account that is NOT an administrator', () => {
  test('is not treated as an administrator', async () => {
    assert.equal((await asStranger(`select public.is_admin() as ok`))[0].ok, false);
  });

  test('sees only the published content, like any guest', async () => {
    assert.deepEqual((await asStranger(`select id from public.site_content`)).map((row) => row.id), ['published']);
  });

  test('cannot change content, publish, or read the history', async () => {
    assert.equal((await asStranger(`update public.site_content set content = '{}'::jsonb where id = 'draft' returning id`)).length, 0);
    assert.equal((await asStranger(`update public.site_content set content = '{}'::jsonb where id = 'published' returning id`)).length, 0);
    await refused(asStranger(`insert into public.site_content (id, content) values ('draft', '{}'::jsonb)`), /23505|42501|row-level security/);
    await refused(asStranger(`select * from public.publish_site(null)`), /not_authorised/);
    assert.equal((await asStranger(`select * from public.site_versions`)).length, 0);
  });

  test('cannot read, change or delete RSVPs', async () => {
    assert.equal((await asStranger(`select * from public.rsvps`)).length, 0);
    assert.equal((await asStranger(`delete from public.rsvps returning id`)).length, 0);
    assert.equal((await asStranger(`update public.rsvps set admin_note = 'x' returning id`)).length, 0);
    assert.ok((await asAdmin(`select count(*)::int as n from public.rsvps`))[0].n > 5, 'the responses must still be there');
  });

  test('cannot see or join the list of administrators', async () => {
    assert.equal((await asStranger(`select * from public.admins`)).length, 0);
    await refused(asStranger(`insert into public.admins (user_id) values ($1)`, [stranger]), /42501|permission denied/);
    await refused(asStranger(`select public.grant_admin('stranger@example.com')`), /42501|permission denied/);
  });

  test('cannot upload, list, replace or delete files', async () => {
    await refused(asStranger(`insert into storage.objects (bucket_id, name) values ('media', 'images/hack.jpg')`), /42501|row-level security/);
    assert.equal((await asStranger(`select * from storage.objects`)).length, 0);
  });
});

describe('administrator: RSVPs and files', () => {
  test('can read every response', async () => {
    assert.ok((await asAdmin(`select * from public.rsvps`)).length > 5);
  });

  test('can add a private note but cannot rewrite what a guest sent', async () => {
    assert.equal((await asAdmin(`update public.rsvps set admin_note = 'Called to confirm' where mobile = '9876543210' returning id`)).length, 1);
    await refused(asAdmin(`update public.rsvps set guest_count = 9 where mobile = '9876543210'`), /42501|permission denied/);
  });

  test('can delete a response', async () => {
    assert.equal((await asAdmin(`delete from public.rsvps where mobile = '9000000004' returning id`)).length, 1);
  });

  test('can upload, list and delete files in the media bucket only', async () => {
    await asAdmin(`insert into storage.objects (bucket_id, name) values ('media', 'images/photo.jpg')`);
    assert.equal((await asAdmin(`select name from storage.objects where bucket_id = 'media'`)).length, 1);
    await db.query(`insert into storage.buckets (id, name) values ('private-stuff', 'private-stuff')`);
    await refused(asAdmin(`insert into storage.objects (bucket_id, name) values ('private-stuff', 'x.jpg')`), /42501|row-level security/);
    assert.equal((await asAdmin(`delete from storage.objects where bucket_id = 'media' returning id`)).length, 1);
  });

  test('guests cannot upload, list or delete files', async () => {
    await refused(guest(`insert into storage.objects (bucket_id, name) values ('media', 'images/guest.jpg')`), /42501|row-level security/);
    assert.equal((await guest(`select * from storage.objects`)).length, 0);
  });

  test('the media bucket is public for viewing and limited to pictures and audio of 25 MB', async () => {
    const bucket = (await db.query(`select public, file_size_limit, allowed_mime_types from storage.buckets where id = 'media'`)).rows[0];
    assert.equal(bucket.public, true);
    assert.equal(Number(bucket.file_size_limit), 26214400);
    assert.ok(bucket.allowed_mime_types.includes('image/jpeg') && bucket.allowed_mime_types.includes('audio/mpeg'));
    assert.ok(!bucket.allowed_mime_types.includes('text/html') && !bucket.allowed_mime_types.includes('image/svg+xml'));
  });

  test('removing an administrator takes their access away at once', async () => {
    await db.query(`select public.revoke_admin('couple@example.com')`);
    assert.equal((await asAdmin(`select public.is_admin() as ok`))[0].ok, false);
    assert.equal((await asAdmin(`select * from public.rsvps`)).length, 0);
    await db.query(`select public.grant_admin('couple@example.com')`);
    assert.equal((await asAdmin(`select public.is_admin() as ok`))[0].ok, true);
  });
});
