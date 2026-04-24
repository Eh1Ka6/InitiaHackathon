// Back-compat shim: the "stub" module now re-exports the real SDK-backed
// adapter from ./interwovenkit so existing imports continue to work without
// edits across 15+ files.
export {
  InterwovenKitProvider,
  useInterwovenKit,
  useUsernameQuery,
  type BridgeTransferDetails,
} from "./interwovenkit";
