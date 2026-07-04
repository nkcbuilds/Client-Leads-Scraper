Desktop branding assets live here.

Generated desktop icons:

- `icon.png`
- `icon.ico`
- `icon.icns`

Source + generator:

- `icon-source.svg`
- `../scripts/generate-icons.mjs`

Regenerate icons after changing the source artwork:

```bash
npm run desktop:generate-icons
```

macOS signing and notarization environment variables used by `desktop/notarize.js`:

- `APPLE_ID`
- `APPLE_APP_SPECIFIC_PASSWORD`
- `APPLE_TEAM_ID`

GitHub Actions release workflow reads those values from repository secrets with the same names.
