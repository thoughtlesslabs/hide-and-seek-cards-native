# Hide & Seek Cards release evidence

## Canonical source and deployment

- Repository: https://github.com/thoughtlesslabs/hide-and-seek-cards-native
- Integration branch: `master`
- Release branch: `codex/hide-seek-v1-release`
- Application ID: `com.thoughtlesslabs.hideandseekcards`
- Production: https://cards.thoughtlesslabs.com (Docker/Caddy/Redis VPS)
- Vercel is not part of the production architecture.

The September 8, 2026 repository correction joins the native repository's previous `master` (`2eedd9fc4b9c08974a405193853404f1d5d9ad69`) to the tested Capacitor release (`9c42b897d33e813e1ffc50ad57cc18e8fa0d9b74`). The merge preserves the tested release tree exactly and keeps the earlier Expo implementation in history. The original release commit is `a2423655723159e91a8698e17700e43a7b626986`. No branch history was force-pushed.

## Verified engineering evidence

- September 2: [CI run](https://github.com/thoughtlesslabs/v0-hide-and-seek-cards/actions/runs/33644439306) passed lint, TypeScript, 149 tests, client/server builds, store asset validation, Android test/lint/release bundle, iOS simulator Release build, and production container build. That run belongs to the formerly selected repository; a new run is required on the canonical repository.
- August 20: production web smoke covered Solo, Quick Match bot fill, Private Room creation, and reactions. A post-deployment check confirmed multiplayer reconnect and Private Room creation/leaving.
- September 8: public `/readyz` returned `ok: true`, `degraded: false`, `persistence: durable`, and `snapshotStore: redis`.

## Store state last observed August 20, 2026

These entries are historical observations, not a claim that testing, review, or public release has since completed.

| Platform | Recorded state |
| --- | --- |
| Apple | App Store Connect app `6803158198`, version 1.0.0, build 2; assigned to `Hide & Seek Cards Internal QA`, tester invited. iPhone only, free, Canada/US. Metadata, privacy labels, review contact and notes saved. No public App Review submission was made. |
| Google | App `4973634236537988561`; internal release `1.0.0 (1) - Internal QA` available to internal testers; tester list attached. Listing and app-content declarations completed. No production review submission was made; no pre-launch report was available at that time. |

Google internal test: https://play.google.com/apps/internaltest/4701746480752365544

The uploaded Android AAB SHA-256 is `3d1bcffcc80d4f97e001ab0612fc3e33841d5d46410684edc12e5f45dc39e80f`. Signing identities are documented in [Developer account handoff](./DEVELOPER_ACCOUNT_HANDOFF.md); private keys and passwords stay outside Git.

## Remaining launch evidence

- Refresh both store consoles for current build, policy, testing, and review status.
- Record store-delivered physical-device testing; CI and web smoke do not prove it.
- Resolve any required Google closed-testing/production-access gate and obtain the applicable pre-launch report.
- Complete the applicable [release checklist](./STORE_RELEASE_CHECKLIST.md) from evidence before public rollout.
