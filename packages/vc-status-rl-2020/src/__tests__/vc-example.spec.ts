import { ld as vc } from '@transmute/vc.js';
import { Ed25519Signature2018 } from '@transmute/ed25519-signature-2018';
import { Ed25519KeyPair } from '@transmute/did-key-ed25519';

import { createList, decodeList, createCredential, checkStatus } from '..';

import {
  documentLoader,
  signedRevocationList2020,
  signedCredentialWithRevocationStatus,
} from '../__fixtures__';

let suite: Ed25519Signature2018;

beforeAll(async () => {
  suite = new Ed25519Signature2018({
    key: Ed25519KeyPair.from({
      id:
        'did:key:z6MkjdvvhidKavKoWwkdf4Sb8JkHTvnFUsGxvbmNMJUBPJs4#z6MkjdvvhidKavKoWwkdf4Sb8JkHTvnFUsGxvbmNMJUBPJs4',
      type: 'JsonWebKey2020',
      controller: 'did:key:z6MkjdvvhidKavKoWwkdf4Sb8JkHTvnFUsGxvbmNMJUBPJs4',
      publicKeyJwk: {
        crv: 'Ed25519',
        x: 'TQY0tCyM0wMZhJbDQ9B-IoZXWN9hS8bCHkpwVXlVves',
        kty: 'OKP',
      },
      privateKeyJwk: {
        crv: 'Ed25519',
        d: 'XbVr_jPdbQXCoH9hvO1YbSkH7f-FfVl90hH8MKYW44I',
        x: 'TQY0tCyM0wMZhJbDQ9B-IoZXWN9hS8bCHkpwVXlVves',
        kty: 'OKP',
      },
    }),
    // adding date here makes this fixture stable
    date: '2021-03-01T01:16:12.860Z',
  });
});

it('issuer can create signed revocation list', async () => {
  const id = 'https://example.com/status/2';
  const list = await createList({ length: 100000 });
  const verifiableCredentialStatusList = await vc.issue({
    credential: {
      ...(await createCredential({ id, list })),
      issuer: suite.key.controller,
      issuanceDate: '2021-03-01T01:16:12.860Z',
    },
    suite,
    documentLoader,
  });
  expect(verifiableCredentialStatusList).toEqual(signedRevocationList2020);
});

it('issuer can create credential with revocation status', async () => {
  const verifiableCredentialWithRevocationStatus = await vc.issue({
    credential: {
      '@context': [
        'https://www.w3.org/2018/credentials/v1',
        'https://w3id.org/vc-revocation-list-2020/v1',
      ],
      id: 'https://example.com/credenials/123',
      type: ['VerifiableCredential'],
      issuer: 'did:key:z6MkjdvvhidKavKoWwkdf4Sb8JkHTvnFUsGxvbmNMJUBPJs4',
      issuanceDate: '2021-03-01T01:16:12.860Z',
      credentialStatus: {
        id: 'https://example.com/status/2#0',
        type: 'RevocationList2020Status',
        revocationListIndex: '0',
        revocationListCredential: 'https://example.com/status/2',
      },
      credentialSubject: {
        id: 'did:example:123',
      },
    },
    suite,
    documentLoader,
  });

  expect(verifiableCredentialWithRevocationStatus).toEqual(
    signedCredentialWithRevocationStatus
  );
});

it('verifier can check revocation status', async () => {
  const result = await checkStatus({
    credential: signedCredentialWithRevocationStatus,
    documentLoader,
    suite: new Ed25519Signature2018(),
    verifyRevocationListCredential: true,
  });
  expect(result.verified).toBe(true);
});

it('verifier can verifer credential with "credentialStatus"', async () => {
  const result = await vc.verifyCredential({
    credential: signedCredentialWithRevocationStatus,
    documentLoader,
    suite: new Ed25519Signature2018(),
    checkStatus, // required
  });
  expect(result.verified).toBe(true);
});

it('issuer can revoke credential by updating revocation status list', async () => {
  const list = await decodeList(signedRevocationList2020.credentialSubject);
  list.setRevoked(0, true);
  const verifiableCredentialStatusList = await vc.issue({
    credential: {
      ...(await createCredential({
        id: signedRevocationList2020.id,
        list,
      })),
      issuer: suite.key.controller,
      issuanceDate: '2021-03-01T01:16:12.860Z',
    },
    suite,
    documentLoader,
  });

  const result = await vc.verifyCredential({
    credential: signedCredentialWithRevocationStatus,
    documentLoader: (iri: string) => {
      if (iri === 'https://example.com/status/2') {
        return {
          documentUrl: iri,
          document: verifiableCredentialStatusList,
        };
      }
      return documentLoader(iri);
    },
    suite: new Ed25519Signature2018(),
    checkStatus, // required
  });
  expect(result.verified).toBe(false);
});
