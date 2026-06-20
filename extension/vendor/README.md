# vendor/

The Ableton Extensions SDK is a **beta-gated** distribution (Centercode). It is
not on npm and not committed here. After you download and unpack the SDK, copy
its three tarballs into this folder:

```
extension/vendor/
├── ableton-create-extension-<version>.tgz   # scaffolder (optional, for reference)
├── ableton-extensions-cli-<version>.tgz     # build/run/package CLI
└── ableton-extensions-sdk-<version>.tgz     # the SDK library
```

If your SDK ships a version other than `1.0.0-beta.0`, update the matching
`file:./vendor/...` paths in `../package.json` so they point at the real filenames.
Then `npm install` from `extension/`.
