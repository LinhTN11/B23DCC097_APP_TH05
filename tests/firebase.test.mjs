/* eslint-env node, es2022 */
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { test } from 'node:test';

const authOrigin = 'http://127.0.0.1:9099';
const databaseOrigin = 'http://127.0.0.1:9000';
const namespace = 'demo-tanso-default-rtdb';
const serverTime = { '.sv': 'timestamp' };

function authRequest(action, body) {
  return fetch(
    `${authOrigin}/identitytoolkit.googleapis.com/v1/accounts:${action}?key=local-demo-key`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    },
  );
}

async function signUp() {
  const response = await authRequest('signUp', {
    email: `qa-${randomBytes(5).toString('hex')}@example.test`,
    password: 'local-test-password',
    returnSecureToken: true,
  });
  assert.equal(response.status, 200);
  const { localId, idToken } = await response.json();
  return { uid: localId, token: idToken };
}

async function databaseRequest(
  path,
  account,
  method = 'GET',
  value,
  options = {},
) {
  const url = new URL(`/${path}.json`, databaseOrigin);
  url.searchParams.set('ns', namespace);
  if (account?.token) {
    url.searchParams.set('auth', account.token);
  }
  for (const [key, parameter] of Object.entries(options)) {
    url.searchParams.set(key, JSON.stringify(parameter));
  }

  return fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: value === undefined ? undefined : JSON.stringify(value),
  });
}

async function allow(request) {
  const response = await request;
  const body = await response.json();
  assert.equal(response.status, 200, JSON.stringify(body));
  return body;
}

async function deny(request) {
  const response = await request;
  assert.ok(
    response.status === 401 || response.status === 403,
    `Expected denied operation, got ${
      response.status
    }: ${await response.text()}`,
  );
}

function sendPaths(
  sender,
  recipient,
  payload,
  id = randomBytes(10).toString('hex'),
) {
  const base = `chats/${[sender.uid, recipient.uid].sort().join('/')}/messages`;
  const message = { ...payload, senderId: sender.uid, createdAt: serverTime };
  const marker = `unread/${recipient.uid}/${sender.uid}/${id}`;
  return {
    id,
    base,
    marker,
    paths: {
      [`${base}/${id}`]: message,
      [`inbox/${sender.uid}/${recipient.uid}`]: { ...message, id },
      [`inbox/${recipient.uid}/${sender.uid}`]: { ...message, id },
      [marker]: serverTime,
    },
  };
}

test('RTDB permissions, atomic fan-out and unread isolation', async t => {
  const [first, second, third] = await Promise.all([
    signUp(),
    signUp(),
    signUp(),
  ]);
  t.after(async () => {
    // The emulator-only owner credential removes the isolated test paths.
    const owner = { token: 'owner' };
    const sorted = [first.uid, second.uid].sort();
    const paths = [
      `chats/${sorted.join('/')}`,
      ...[first, second, third].flatMap(({ uid }) =>
        ['profiles', 'presence', 'inbox', 'unread'].map(key => `${key}/${uid}`),
      ),
    ];
    await Promise.all(
      paths.map(path => databaseRequest(path, owner, 'DELETE')),
    );
    await Promise.all(
      [first, second, third].map(({ token }) =>
        authRequest('delete', { idToken: token }),
      ),
    );
  });

  await deny(databaseRequest('profiles', null));
  for (const [person, name] of [
    [first, 'Nguyễn Ánh'],
    [second, 'Trần Thanh'],
    [third, 'Lê Vũ'],
  ]) {
    await allow(
      databaseRequest(`profiles/${person.uid}`, person, 'PUT', { name }),
    );
  }
  await deny(
    databaseRequest(`profiles/${first.uid}`, second, 'PUT', {
      name: 'Tên khác',
    }),
  );
  await deny(
    databaseRequest(`profiles/${first.uid}`, first, 'PUT', {
      name: 'Nguyễn Ánh',
      email: 'private@example.test',
    }),
  );
  assert.equal(
    (await allow(databaseRequest('profiles', first)))[second.uid].name,
    'Trần Thanh',
  );

  const online = `presence/${first.uid}/connection-1`;
  await allow(databaseRequest(online, first, 'PUT', true));
  await deny(databaseRequest(online, second, 'DELETE'));
  assert.equal(await allow(databaseRequest(online, second)), true);
  await allow(databaseRequest(online, first, 'DELETE'));

  const text = sendPaths(first, second, {
    kind: 'text',
    text: 'Xin chào!\nCó ai online?',
  });
  await deny(
    databaseRequest(
      `${text.base}/${text.id}`,
      first,
      'PUT',
      text.paths[`${text.base}/${text.id}`],
    ),
  );
  await deny(databaseRequest('', third, 'PATCH', text.paths));
  await allow(databaseRequest('', first, 'PATCH', text.paths));
  const delivered = await allow(
    databaseRequest(`${text.base}/${text.id}`, second),
  );
  assert.equal(delivered.text, 'Xin chào!\nCó ai online?');
  assert.equal(delivered.senderId, first.uid);
  assert.ok(Number.isInteger(delivered.createdAt));
  assert.equal(
    (await allow(databaseRequest(`inbox/${second.uid}/${first.uid}`, second)))
      .id,
    text.id,
  );
  await deny(databaseRequest(text.base, third));
  await deny(databaseRequest(`inbox/${second.uid}`, first));
  await deny(databaseRequest(`unread/${second.uid}`, third));
  await deny(databaseRequest(text.marker, first, 'DELETE'));

  const location = sendPaths(first, second, {
    kind: 'location',
    latitude: 21.03,
    longitude: 105.85,
  });
  await allow(databaseRequest('', first, 'PATCH', location.paths));
  await allow(databaseRequest(text.marker, second, 'DELETE'));
  assert.equal(await allow(databaseRequest(text.marker, second)), null);
  assert.ok(
    Number.isInteger(await allow(databaseRequest(location.marker, second))),
  );
  const preview = await allow(
    databaseRequest(`inbox/${first.uid}/${second.uid}`, first),
  );
  assert.equal(preview.latitude, 21.03);
  await deny(databaseRequest('', first, 'PATCH', text.paths));

  const invalidLocation = sendPaths(second, first, {
    kind: 'location',
    latitude: 91,
    longitude: 105.85,
  });
  await deny(databaseRequest('', second, 'PATCH', invalidLocation.paths));
  assert.equal(
    await allow(databaseRequest(`${text.base}/${invalidLocation.id}`, first)),
    null,
  );

  const emptyText = sendPaths(second, first, {
    kind: 'text',
    text: '  \t\r\n ',
  });
  await deny(databaseRequest('', second, 'PATCH', emptyText.paths));
  const reply = sendPaths(second, first, { kind: 'text', text: 'Chào bạn!' });
  await allow(databaseRequest('', second, 'PATCH', reply.paths));
  const latest = await allow(
    databaseRequest(text.base, first, 'GET', undefined, {
      orderBy: 'createdAt',
      limitToLast: 1,
    }),
  );
  assert.deepEqual(Object.keys(latest), [reply.id]);
  assert.equal(
    (await allow(databaseRequest(`inbox/${first.uid}/${second.uid}`, first)))
      .id,
    reply.id,
  );
});

test(
  'SDK listeners update across two authenticated clients',
  { timeout: 20_000 },
  async t => {
    const { initializeApp, deleteApp } = await import('firebase/app');
    const {
      getAuth,
      connectAuthEmulator,
      createUserWithEmailAndPassword,
      deleteUser,
    } = await import('firebase/auth');
    const {
      getDatabase,
      connectDatabaseEmulator,
      goOffline,
      onDisconnect,
      onValue,
      ref,
      set,
      update,
    } = await import('firebase/database');

    const config = {
      apiKey: 'local-demo-key',
      projectId: 'demo-tanso',
      databaseURL: `https://${namespace}.firebaseio.com`,
    };

    function makeClient(name) {
      const app = initializeApp(config, `qa-${name}`);
      const auth = getAuth(app);
      const database = getDatabase(app);
      connectAuthEmulator(auth, authOrigin, { disableWarnings: true });
      connectDatabaseEmulator(database, '127.0.0.1', 9000);
      return { app, auth, database };
    }

    // Wait for a specific snapshot so local cache emissions cannot satisfy a live update.
    function waitValue(database, path, matches) {
      return new Promise((resolve, reject) => {
        let unsubscribe;
        const timer = setTimeout(() => {
          unsubscribe?.();
          reject(new Error(`Timed out waiting for ${path}`));
        }, 8_000);

        function finish(callback, value) {
          clearTimeout(timer);
          queueMicrotask(() => unsubscribe?.());
          callback(value);
        }

        unsubscribe = onValue(
          ref(database, path),
          snapshot => {
            if (matches(snapshot.val())) {
              finish(resolve, snapshot.val());
            }
          },
          error => finish(reject, error),
        );
      });
    }

    const first = makeClient('first');
    const second = makeClient('second');
    const clients = [first, second];
    t.after(async () => {
      const ids = clients
        .map(client => client.auth.currentUser?.uid)
        .filter(Boolean);
      const owner = { token: 'owner' };
      const paths = ids.flatMap(uid =>
        ['profiles', 'presence', 'inbox', 'unread'].map(key => `${key}/${uid}`),
      );
      if (ids.length === 2) {
        paths.push(`chats/${ids.sort().join('/')}`);
      }
      await Promise.all(
        paths.map(path => databaseRequest(path, owner, 'DELETE')),
      );
      await Promise.all(
        clients.map(async ({ app, auth }) => {
          if (auth.currentUser) {
            await deleteUser(auth.currentUser);
          }
          await deleteApp(app);
        }),
      );
    });

    const [sender, recipient] = await Promise.all(
      clients.map(async ({ auth, database }, index) => {
        const credentials = await createUserWithEmailAndPassword(
          auth,
          `listener-${randomBytes(5).toString('hex')}@example.test`,
          'local-test-password',
        );
        const { uid } = credentials.user;
        await set(ref(database, `profiles/${uid}`), {
          name: `Người thử ${index + 1}`,
        });
        return { uid };
      }),
    );

    await waitValue(first.database, '.info/connected', value => value === true);
    const presencePath = `presence/${sender.uid}/listener-test`;
    const online = waitValue(
      second.database,
      presencePath,
      value => value === true,
    );
    await onDisconnect(ref(first.database, presencePath)).remove();
    await set(ref(first.database, presencePath), true);
    assert.equal(await online, true);

    const message = sendPaths(sender, recipient, {
      kind: 'text',
      text: 'Tin nhắn trực tiếp',
    });
    const delivered = waitValue(
      second.database,
      `${message.base}/${message.id}`,
      Boolean,
    );
    const unread = waitValue(second.database, message.marker, Number.isInteger);
    await update(ref(first.database), message.paths);
    assert.equal((await delivered).text, 'Tin nhắn trực tiếp');
    assert.equal(await unread, (await delivered).createdAt);

    const offline = waitValue(
      second.database,
      presencePath,
      value => value === null,
    );
    goOffline(first.database);
    assert.equal(await offline, null);
  },
);
