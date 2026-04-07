KeyPass Apple Wallet pass model
================================

This directory is the template ("model") consumed by passkit-generator at
runtime. The runtime backend overrides the placeholder fields below with
real user data, then signs and zips the result into a .pkpass.

REQUIRED FILES (you must add these before Apple Wallet will work):

  icon.png      29x29 px
  icon@2x.png   58x58 px
  icon@3x.png   87x87 px (optional but recommended)
  logo.png      up to 160x50 px
  logo@2x.png   up to 320x100 px

Both icon.png and logo.png are mandatory — Apple rejects passes without them.

CONFIG OVERRIDES (set in .env, applied at runtime by backend/src/wallet/apple.ts):

  APPLE_PASS_TYPE_ID  -> overrides "passTypeIdentifier"
  APPLE_TEAM_ID       -> overrides "teamIdentifier"

Both pass.json values above ("pass.co.keypass.membership" and "TEAMID") are
placeholders — passkit-generator replaces them from the props passed at
PKPass.from(...) time.
