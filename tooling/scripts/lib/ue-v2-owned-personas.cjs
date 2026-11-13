// Existing synthetic directory identities. Passwords are protected environment secrets.
// A requested role never provisions a role or overrides the live membership API.
const ORG = 'b96359c3-a8de-458c-8469-afc084b7fbc0';
const identity = (oid, account, passwordEnv) => ({oid, upn: `ue-v2-staging-${account}-20261113@anungisayahoo.onmicrosoft.com`, org: ORG, passwordEnv});
const officer = identity('ecb4f1d7-b0ae-44f8-bf56-832bc173fc49', 'seniorrep', 'UE_V2_STAGING_PERSONA_A_PASSWORD');
module.exports = {
  member: identity('6a0fe972-ed1c-49ca-83c8-00b9b214f96f', 'member', 'UE_V2_STAGING_MEMBER_PASSWORD'),
  steward: identity('c01e5647-8506-4101-bb52-2547000a9e02', 'steward', 'UE_V2_STAGING_STEWARD_PASSWORD'),
  chief_steward: officer,
  officer,
  secretary_treasurer: identity('bc42cb91-b331-46d9-87a1-970e1af814e4', 'executive', 'UE_V2_STAGING_EXECUTIVE_PASSWORD'),
  admin: identity('dc871813-4d38-4ead-8867-6cc8438b863e', 'admingov', 'UE_V2_STAGING_ADMINGOV_PASSWORD'),
  app_owner: identity('ed62b48a-ce93-4e4e-b56c-fb8a32e751f1', 'platformops', 'UE_V2_STAGING_PLATFORMOPS_PASSWORD'),
};
